import { describe, expect, it } from 'vitest';
import type { Collection } from '../types/api';
import { buildQueryModel, emptyDim } from '../query/queryModel';
import { buildQueryUrl } from '../query/buildQueryUrl';
import { normalizeHref, repairAppendedHref, resolveCollectionHrefs, resolveHref } from './href';
import dmi from './__fixtures__/dmi-appended-hrefs.json';

const dmiCollection = () => structuredClone(dmi.collection) as unknown as Collection;

describe('resolveHref', () => {
  it('resolves relative hrefs against the base', () => {
    expect(resolveHref('collections/a', 'https://example.org/edr/')).toBe('https://example.org/edr/collections/a');
    expect(resolveHref('/edr/collections/a', 'https://example.org/x/')).toBe('https://example.org/edr/collections/a');
    expect(resolveHref('collections/a')).toBe('collections/a');
  });
});

describe('normalizeHref', () => {
  it('picks a language from an href object, preferring English', () => {
    expect(normalizeHref({ fr: 'https://example.org/fr', en: 'https://example.org/en' })).toBe('https://example.org/en');
    expect(normalizeHref({ fi: 'https://example.org/fi' })).toBe('https://example.org/fi');
  });

  it('refuses unsafe protocols and missing hrefs', () => {
    expect(normalizeHref('javascript:alert(1)')).toBeNull();
    expect(normalizeHref(undefined)).toBeNull();
  });
});

describe('repairAppendedHref', () => {
  const request = 'https://opendataapi.dmi.dk/v1/forecastedr/collections?f=json';

  it("moves a collection's path appended after the query string in front of it", () => {
    expect(repairAppendedHref(`${request}/dkss_nsbs/position`, request, 'dkss_nsbs'))
      .toBe('https://opendataapi.dmi.dk/v1/forecastedr/collections/dkss_nsbs/position');
    expect(repairAppendedHref(`${request}/dkss_nsbs`, request, 'dkss_nsbs'))
      .toBe('https://opendataapi.dmi.dk/v1/forecastedr/collections/dkss_nsbs');
    expect(repairAppendedHref(`${request}/run%3A1/position`, request, 'run:1'))
      .toBe('https://opendataapi.dmi.dk/v1/forecastedr/collections/run%3A1/position');
  });

  it('leaves other hrefs alone', () => {
    const own = 'https://opendataapi.dmi.dk/v1/forecastedr/collections/dkss_nsbs/position?f=json';
    expect(repairAppendedHref(own, request, 'dkss_nsbs')).toBe(own);
    // A query value can continue with a slash (a datetime interval): not another collection's path
    const interval = 'https://example.org/edr/collections?datetime=2026-01-01/2026-02-01';
    expect(repairAppendedHref(interval, 'https://example.org/edr/collections?datetime=2026-01-01', 'a')).toBe(interval);
    // Without a query string the href is a plain path below the request URL
    expect(repairAppendedHref('https://example.org/edr/collections/a', 'https://example.org/edr/collections', 'a')).toBe('https://example.org/edr/collections/a');
  });
});

describe('resolveCollectionHrefs', () => {
  it("repairs DMI's data query hrefs and counts them", () => {
    const collection = dmiCollection();
    expect(resolveCollectionHrefs(collection, 'https://opendataapi.dmi.dk/v1/forecastedr/', dmi.requestUrl)).toBe(2);
    expect(collection.data_queries.position.link.href).toBe('https://opendataapi.dmi.dk/v1/forecastedr/collections/dkss_nsbs/position');
    expect(collection.data_queries.cube.link.href).toBe('https://opendataapi.dmi.dk/v1/forecastedr/collections/dkss_nsbs/cube');
    // Its links were fine
    expect(collection.links.map(link => link.href)).toEqual(dmi.collection.links.map(link => link.href));
  });

  it('only resolves without the request URL', () => {
    const collection = { id: 'a', links: [{ href: 'collections/a', rel: 'self' }], data_queries: { position: { link: { href: 'collections/a/position', rel: 'data' } } } } as unknown as Collection;
    expect(resolveCollectionHrefs(collection, 'https://example.org/edr/')).toBe(0);
    expect(collection.links[0].href).toBe('https://example.org/edr/collections/a');
    expect(collection.data_queries.position.link.href).toBe('https://example.org/edr/collections/a/position');
  });

  it('makes a DMI position query request the position endpoint, not the collections list', () => {
    const collection = dmiCollection();
    resolveCollectionHrefs(collection, 'https://opendataapi.dmi.dk/v1/forecastedr/', dmi.requestUrl);
    const url = buildQueryUrl(buildQueryModel({
      collection, queryKey: 'position', format: 'CoverageJSON', parameters: [],
      datetime: emptyDim(), vertical: emptyDim(), customDims: {}, points: [[12.561, 55.715]], polygons: [], bbox: null, bboxAsCoords: false,
      radius: { value: 10, units: 'km' }, queryParams: {}, locationFeature: null,
    })!);
    expect(url).toBe('https://opendataapi.dmi.dk/v1/forecastedr/collections/dkss_nsbs/position?f=CoverageJSON&coords=POINT%2812.561+55.715%29');
  });
});
