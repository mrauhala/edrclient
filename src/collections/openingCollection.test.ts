import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Collection, ValidationResult } from '../types/api';
import { extentsOf, geoJsonLinksOf, queryBaseUrlOf, withLocationsValidation, withoutLocationsValidation } from './openingCollection';

const collection = (overrides: Partial<Collection> = {}) => ({
  id: 'a',
  links: [],
  extent: {},
  ...overrides,
}) as unknown as Collection;
const GEOJSON = { href: 'https://api.test/a/items', rel: 'items', type: 'application/geo+json', title: 'Items' };
const WITH_TIME = { extent: { temporal: { interval: [['2026-01-01T00:00:00Z', null]] } } } as unknown as Partial<Collection>;

describe('geoJsonLinksOf', () => {
  it('takes only GeoJSON links', () => {
    const links = [GEOJSON, { href: 'https://api.test/a', rel: 'self', type: 'application/json' }];
    expect(geoJsonLinksOf(collection({ links } as Partial<Collection>))).toEqual([{ url: GEOJSON.href, title: 'Items' }]);
  });

  it('names a link by its rel, or as a layer', () => {
    const links = [{ ...GEOJSON, title: undefined }, { ...GEOJSON, title: undefined, rel: '' }];
    expect(geoJsonLinksOf(collection({ links } as Partial<Collection>)).map(link => link.title)).toEqual(['items', 'GeoJSON Layer']);
  });

  it('skips a link it cannot read', () => {
    expect(geoJsonLinksOf(collection({ links: [{ ...GEOJSON, href: undefined }] } as unknown as Partial<Collection>))).toEqual([]);
  });

  it('copes with no links', () => {
    expect(geoJsonLinksOf(collection({ links: undefined } as unknown as Partial<Collection>))).toEqual([]);
  });

  it('adds the time chosen, if the collection has time', () => {
    const timed = collection({ links: [GEOJSON], ...WITH_TIME } as Partial<Collection>);
    expect(geoJsonLinksOf(timed, { datetime: '2026-01-02' })[0].url).toBe(`${GEOJSON.href}?datetime=2026-01-02`);
    expect(geoJsonLinksOf(collection({ links: [GEOJSON] } as Partial<Collection>), { datetime: '2026-01-02' })[0].url).toBe(GEOJSON.href);
  });

  it('adds nothing when no time is chosen', () => {
    expect(geoJsonLinksOf(collection({ links: [GEOJSON], ...WITH_TIME } as Partial<Collection>))[0].url).toBe(GEOJSON.href);
  });

  it('adds a range, only when both ends are chosen', () => {
    const timed = collection({ links: [GEOJSON], ...WITH_TIME } as Partial<Collection>);
    expect(geoJsonLinksOf(timed, { mode: 'range', start: 'a', end: 'b' })[0].url).toBe(`${GEOJSON.href}?datetime=a/b`);
    expect(geoJsonLinksOf(timed, { mode: 'range', start: 'a', datetime: 'c' })[0].url).toBe(`${GEOJSON.href}?datetime=c`);
  });

  it('ignores range ends left over when a single time is chosen', () => {
    const timed = collection({ links: [GEOJSON], ...WITH_TIME } as Partial<Collection>);
    expect(geoJsonLinksOf(timed, { mode: 'individual', start: 'a', end: 'b', datetime: 'c' })[0].url).toBe(`${GEOJSON.href}?datetime=c`);
  });

  it('adds to a query that is already there', () => {
    const links = [{ ...GEOJSON, href: 'https://api.test/a/items?f=json' }];
    expect(geoJsonLinksOf(collection({ links, ...WITH_TIME } as Partial<Collection>), { datetime: 'x' })[0].url).toBe('https://api.test/a/items?f=json&datetime=x');
  });
});

describe('queryBaseUrlOf', () => {
  it('follows the data link', () => {
    const links = [{ href: 'https://other.test/data/a', rel: 'data' }];
    expect(queryBaseUrlOf(collection({ links } as Partial<Collection>), 'https://api.test')).toBe('https://other.test/data/a');
  });

  it('falls back on where collections normally are', () => {
    expect(queryBaseUrlOf(collection(), 'https://api.test')).toBe('https://api.test/collections/a');
    expect(queryBaseUrlOf(collection({ links: undefined } as unknown as Partial<Collection>), 'https://api.test')).toBe('https://api.test/collections/a');
  });

  it('ignores a data link it cannot read', () => {
    const links = [{ href: { nope: 1 }, rel: 'data' }];
    expect(queryBaseUrlOf(collection({ links } as unknown as Partial<Collection>), 'https://api.test')).toBe('https://api.test/collections/a');
  });
});

describe('extentsOf', () => {
  afterEach(() => vi.restoreAllMocks());
  const withBbox = (bbox: unknown) => collection({ extent: { spatial: { bbox } } } as unknown as Partial<Collection>);

  it('reads the boxes', () => {
    expect(extentsOf(withBbox([[1, 2, 3, 4]]))).toEqual([[1, 2, 3, 4]]);
  });

  it('has none without a box, which is nothing to warn about', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extentsOf(collection())).toBeNull();
    expect(extentsOf(withBbox([]))).toBeNull();
    expect(extentsOf(withBbox('x'))).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('has none when the box is nonsense', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extentsOf(withBbox([['a']]))).toBeNull();
  });
});

const LOCATIONS_ERROR = { message: 'bad', section: 'Locations' };
const OTHER_ERROR = { message: 'bad', section: 'collections' };

describe('withoutLocationsValidation', () => {
  it('leaves a result without any alone, the same object', () => {
    const result: ValidationResult = { isValid: false, errors: [OTHER_ERROR] };
    expect(withoutLocationsValidation(result)).toBe(result);
  });

  it('removes the section and its errors, keeping the rest', () => {
    const result = withoutLocationsValidation({
      isValid: false,
      errors: [OTHER_ERROR, LOCATIONS_ERROR],
      locationsValidation: { isValid: false, errors: [LOCATIONS_ERROR] },
    });
    expect(result.locationsValidation).toBeUndefined();
    expect(result.errors).toEqual([OTHER_ERROR]);
    expect(result.isValid).toBe(false);
  });

  it('makes the service valid again if that was all that was wrong', () => {
    const result = withoutLocationsValidation({ isValid: false, errors: [LOCATIONS_ERROR], locationsValidation: { isValid: false, errors: [LOCATIONS_ERROR] } });
    expect(result).toEqual({ isValid: true, errors: null });
  });

  it("doesn't count notes against the service", () => {
    const note = { message: 'fyi', severity: 'info' as const };
    expect(withoutLocationsValidation({ isValid: false, errors: [note, LOCATIONS_ERROR] }).isValid).toBe(true);
  });

  it('keeps another section that is still invalid', () => {
    const result = withoutLocationsValidation({
      isValid: false,
      errors: [LOCATIONS_ERROR],
      collectionsValidation: { isValid: false, errors: null },
    });
    expect(result.isValid).toBe(false);
  });

  it('also removes errors left without a section', () => {
    expect(withoutLocationsValidation({ isValid: true, errors: [LOCATIONS_ERROR] }).errors).toBeNull();
  });
});

describe('withLocationsValidation', () => {
  it('adds what was found', () => {
    const result = withLocationsValidation({ isValid: true, errors: [OTHER_ERROR] }, { isValid: false, errors: [LOCATIONS_ERROR] }, '1.1');
    expect(result.locationsValidation).toEqual({ isValid: false, errors: [LOCATIONS_ERROR], schemaResults: [{ schema: 'EDR 1.1 Locations', isValid: false }] });
    expect(result.errors).toEqual([OTHER_ERROR, LOCATIONS_ERROR]);
    expect(result.isValid).toBe(false);
  });

  it('replaces what was found before', () => {
    const result = withLocationsValidation({ isValid: true, errors: [LOCATIONS_ERROR] }, { isValid: true, errors: [] }, '1.1');
    expect(result.errors).toBeNull();
    expect(result.locationsValidation?.errors).toBeNull();
  });

  it("doesn't make an invalid service valid", () => {
    expect(withLocationsValidation({ isValid: false, errors: [OTHER_ERROR] }, { isValid: true, errors: [] }, '1.1').isValid).toBe(false);
  });
});
