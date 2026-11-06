import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CollectionPane from './CollectionPane';
import type { Collection, ValidationResult } from './types/api';

const state = vi.hoisted(() => ({
  selected: null as unknown,
  locations: null as unknown,
  validation: {} as unknown,
  license: null as unknown,
}));
vi.mock('./contexts/ApiContext', () => ({ useApi: () => ({ apiUrl: 'https://a.example', license: state.license }) }));
vi.mock('./contexts/CollectionContext', () => ({ useCollection: () => ({ selectedCollection: state.selected, locationFeatures: state.locations, setSelectedFeature: () => {} }) }));
vi.mock('./contexts/GeoJsonLayerContext', () => ({ useGeoJsonLayers: () => ({ geoJsonLayers: [], setGeoJsonLayers: () => {} }) }));
vi.mock('./contexts/OpenCollectionContext', () => ({ useOpenCollection: () => ({ openSerial: 1 }) }));
vi.mock('./contexts/PanesContext', () => ({ usePanes: () => ({ showMap: () => {}, showPane: () => {} }) }));
vi.mock('./contexts/QueryBuilderContext', () => ({ useQueryBuilder: () => ({}) }));
vi.mock('./contexts/ValidationContext', () => ({ useValidation: () => ({ validationResult: state.validation }) }));
// Each has its own tests, or needs a server: here it's only whether they're there
vi.mock('./CollectionQueryBuilder', () => ({ default: () => <i>the query builder</i> }));
vi.mock('./MapsPanel', () => ({ default: () => <i>the maps panel</i> }));
vi.mock('./ItemsTable', () => ({ default: ({ title }: { title: string }) => <i>the table {title}</i> }));
vi.mock('./LocationFeatureList', () => ({ default: ({ features }: { features: unknown[] }) => <i>{features.length} locations</i> }));

const position = { position: { link: { href: 'https://a.example/collections/one/position', rel: 'data' } } };
const edr = { id: 'one', title: 'First collection', description: 'What it holds', links: [], data_queries: position } as unknown as Collection;
const render = (collection: unknown, validation: ValidationResult = { isValid: true, errors: null }) => {
  state.selected = collection;
  state.validation = validation;
  return renderToStaticMarkup(<CollectionPane />);
};

describe('CollectionPane', () => {
  beforeEach(() => {
    state.locations = null;
    state.license = null;
  });

  it('says when nothing is open, with a way back', () => {
    const html = render(null);
    expect(html).toContain('No collection is open.');
    expect(html).toContain("Choose one from the API&#x27;s list");
    expect(html).not.toContain('All collections');
  });

  it('heads it with name, ID and description, and a way back', () => {
    const html = render(edr);
    expect(html).toContain('All collections');
    expect(html).toContain('First collection');
    expect(html).toContain('>one<');
    expect(html).toContain('What it holds');
    expect(html.indexOf('All collections')).toBeLessThan(html.indexOf('First collection'));
    expect(html.indexOf('First collection')).toBeLessThan(html.indexOf('>one<'));
  });

  it('has a name for it whatever an API left out', () => {
    expect(render({ ...edr, title: undefined })).toContain('>one<');
    expect(render({ ...edr, title: undefined, id: undefined })).toContain('Untitled collection');
    expect(render({ ...edr, title: undefined, id: 42 })).toContain('>42<');
    expect(render({ ...edr, id: undefined })).toContain('First collection');
    expect(render({ ...edr, links: undefined })).toContain('First collection');
  });

  // The line under the name, which is set in monospace
  const idLine = (html: string) => html.includes('font-family:monospace');

  it('names it by its ID only once, with no title', () => {
    const html = render({ ...edr, title: undefined });
    expect(html.split('>one<').length - 1).toBe(1);
    expect(idLine(html)).toBe(false);
  });

  it('has no ID line without an ID', () => {
    expect(idLine(render(edr))).toBe(true);
    expect(idLine(render({ ...edr, id: undefined }))).toBe(false);
  });

  it('shows an ID of 0 as an ID', () => {
    const html = render({ ...edr, id: 0 });
    expect(html).toContain('>0<');
    expect(idLine(html)).toBe(true);
  });

  it('marks the issues the validation found', () => {
    expect(render(edr)).not.toContain('Valid<');
    expect(render(edr, { isValid: true, errors: null, collectionErrors: {} })).toContain('✓ Valid');
    const one = { isValid: false, errors: null, collectionErrors: { one: [{ message: 'x' }] } };
    expect(render(edr, one)).toContain('⚠ 1 issue<');
    expect(render(edr, { ...one, collectionErrors: { one: [{ message: 'x' }, { message: 'y' }] } })).toContain('⚠ 2 issues');
  });

  it('sums up what About holds, closed at first', () => {
    const html = render({ ...edr, keywords: ['a', 'b', 'c'], extent: { spatial: { crs: 'CRS84' } } });
    expect(html).toContain('About: CRS, 3 keywords');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('>CRS84<');
  });

  it("counts the API's licence, for a collection with none of its own", () => {
    state.license = { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' };
    expect(render(edr)).toContain('About: license');
  });

  it('has no About with nothing to say', () => {
    expect(render(edr)).not.toContain('About');
  });

  it('shows the query builder for a collection with queries, and no table', () => {
    const html = render(edr);
    expect(html).toContain('the query builder');
    expect(html).not.toContain('the table');
    expect(html).not.toContain('the maps panel');
  });

  it('shows no query row for a collection without queries', () => {
    expect(render({ ...edr, data_queries: undefined })).not.toContain('the query builder');
    expect(render({ ...edr, data_queries: {} })).not.toContain('the query builder');
  });

  it('shows the table of a Features, Records or STAC collection', () => {
    const items = { ...edr, data_queries: undefined, links: [
      { href: 'https://a.example/collections/one/items', rel: 'items', type: 'application/geo+json', title: 'Its items' },
      { href: 'https://a.example/collections/one/items?f=html', rel: 'items', type: 'text/html' },
    ] };
    const html = render(items);
    expect(html).toContain('the table Its items');
    expect(html.split('the table').length - 1).toBe(1);
    expect(html).not.toContain('the query builder');
  });

  it('makes no table of other GeoJSON links, which are map layers', () => {
    const layer = { ...edr, links: [{ href: 'https://a.example/collections/one/layer', rel: 'alternate', type: 'application/geo+json' }] };
    expect(render(layer)).not.toContain('the table');
  });

  it('calls a table with no title Items, and leaves out one with no address', () => {
    const items = (link: object) => ({ ...edr, links: [{ rel: 'items', type: 'application/geo+json', ...link }] });
    expect(render(items({ href: 'https://a.example/items' }))).toContain('the table Items');
    expect(render(items({ href: '' }))).not.toContain('the table');
  });

  it('keeps the maps panel mounted for a Maps collection, which writes the request line', () => {
    const maps = { ...edr, data_queries: undefined, links: [{ href: 'https://a.example/collections/one/map', rel: 'http://www.opengis.net/def/rel/ogc/1.0/map', type: 'image/png' }] };
    const html = render(maps);
    expect(html).toContain('the maps panel');
    expect(html).not.toContain('the query builder');
  });

  it('lists the locations once they are in', () => {
    const locations = { position: { link: { href: 'https://a.example/p', rel: 'data' } }, locations: { link: { href: 'https://a.example/collections/one/locations', rel: 'data' } } };
    const collection = { ...edr, data_queries: locations };
    expect(render(collection)).not.toContain('locations<');
    state.locations = [{}, {}, {}];
    expect(render(collection)).toContain('3 locations');
    expect(render(edr)).not.toContain('3 locations');
  });

  it('keeps the validation details closed at first', () => {
    const html = render(edr);
    expect(html).toContain('Show Validation');
    expect(html).not.toContain('A: ID');
  });
});
