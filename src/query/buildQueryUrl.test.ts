import { describe, expect, it } from 'vitest';
import type { Collection } from '../types/api';
import { normalizeHref } from '../utils/href';
import { buildQueryModel, emptyDim, type LocationFeature, type QueryModelInput } from './queryModel';
import { buildQueryUrl, collectionBaseUrl } from './buildQueryUrl';
import type { DimSelection } from './types';
import fmiEcmwf from './__fixtures__/fmi-ecmwf.json';
import fmiPainepinta from './__fixtures__/fmi-ecmwf-painepinta.json';
import dwdIcon from './__fixtures__/dwd-icon-d2-ruc-single-level.json';
import meteocoreObs from './__fixtures__/meteocore-fmi-obs.json';
import metofficePop from './__fixtures__/metoffice-global-pop-density.json';

const COLLECTIONS = { fmiEcmwf, fmiPainepinta, dwdIcon, meteocoreObs, metofficePop } as unknown as Record<string, Collection>;

// useQueryUrl's buildUrlWithParams before the query model existed, kept verbatim as the reference
function legacyBuildUrl(
  baseUrl: string, format: string, parameters: string[], coords: [number, number][] | null,
  area: [number, number][][] | null, radius: number | undefined, queryType: string, locationFeature: LocationFeature | null,
  datetime: string, dtMode: 'individual' | 'range', dtStart: string, dtEnd: string,
  vertical: string, vMode: 'individual' | 'range', vStart: string, vEnd: string,
  customDims: Record<string, string>, customDimModes: Record<string, 'individual' | 'range'>,
  customDimStarts: Record<string, string>, customDimEnds: Record<string, string>,
): string {
  let url = new URL(baseUrl);
  if (queryType.toLowerCase() === 'locations' && locationFeature) {
    if (locationFeature.properties?.href) {
      url = new URL(locationFeature.properties.href);
    } else if (locationFeature.id) {
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      const locationId = String(locationFeature.id);
      if (pathParts[pathParts.length - 1] !== locationId) {
        pathParts.push(locationId);
        url.pathname = '/' + pathParts.join('/');
      }
    }
  }
  if (format) url.searchParams.set('f', format); else url.searchParams.delete('f');
  if (parameters && parameters.length > 0) url.searchParams.set('parameter-name', parameters.join(','));
  else url.searchParams.delete('parameter-name');
  if (dtMode === 'range' && dtStart && dtEnd) url.searchParams.set('datetime', `${dtStart}/${dtEnd}`);
  else if (dtMode === 'individual' && datetime) url.searchParams.set('datetime', datetime);
  else url.searchParams.delete('datetime');
  if (vMode === 'range' && vStart && vEnd) url.searchParams.set('z', `${vStart}/${vEnd}`);
  else if (vMode === 'individual' && vertical) url.searchParams.set('z', vertical);
  else url.searchParams.delete('z');
  Object.keys(customDims).forEach(dimensionId => {
    const mode = customDimModes[dimensionId] || 'individual';
    const value = customDims[dimensionId];
    const start = customDimStarts[dimensionId];
    const end = customDimEnds[dimensionId];
    if (mode === 'range' && start && end) url.searchParams.set(dimensionId, `${start}/${end}`);
    else if (mode === 'individual' && value) url.searchParams.set(dimensionId, value);
    else url.searchParams.delete(dimensionId);
  });
  const q = queryType.toLowerCase();
  if (q === 'position' && coords && coords.length > 0) {
    if (coords.length === 1) {
      const [lon, lat] = coords[0];
      url.searchParams.set('coords', `POINT(${lon.toFixed(3)} ${lat.toFixed(3)})`);
    } else {
      url.searchParams.set('coords', `MULTIPOINT(${coords.map(c => `(${c[0].toFixed(3)} ${c[1].toFixed(3)})`).join(',')})`);
    }
  } else if (q === 'trajectory' && coords && coords.length > 1) {
    url.searchParams.set('coords', `LINESTRING(${coords.map(c => `${c[0].toFixed(3)} ${c[1].toFixed(3)}`).join(', ')})`);
  } else if (q === 'radius' && coords && coords.length > 0) {
    if (coords.length === 1) {
      const [lon, lat] = coords[0];
      url.searchParams.set('coords', `POINT(${lon.toFixed(3)} ${lat.toFixed(3)})`);
    } else {
      url.searchParams.set('coords', `MULTIPOINT(${coords.map(c => `(${c[0].toFixed(3)} ${c[1].toFixed(3)})`).join(',')})`);
    }
    if (radius !== undefined) {
      url.searchParams.set('within', radius.toString());
      url.searchParams.set('within-units', 'km');
    }
  } else if (q === 'area' && area && area.length > 0) {
    if (area.length === 1) {
      url.searchParams.set('coords', `POLYGON((${area[0].map(c => `${c[0].toFixed(2)} ${c[1].toFixed(2)}`).join(',')}))`);
    } else {
      const polygons = area.map(p => `((${p.map(c => `${c[0].toFixed(2)} ${c[1].toFixed(2)}`).join(',')}))`).join(',');
      url.searchParams.set('coords', `MULTIPOLYGON(${polygons})`);
    }
  } else if (q !== 'locations') {
    url.searchParams.delete('coords');
    url.searchParams.delete('within');
    url.searchParams.delete('within-units');
  }
  return url.toString();
}

const DATETIMES: DimSelection[] = [
  emptyDim(),
  { mode: 'individual', value: '2026-10-05T12:00:00Z', start: '', end: '' },
  { mode: 'range', value: '', start: '2026-10-05T00:00:00Z', end: '2026-10-06T00:00:00Z' },
  { mode: 'range', value: '', start: '2026-10-05T00:00:00Z', end: '' },
];
const VERTICALS: DimSelection[] = [
  emptyDim(),
  { mode: 'individual', value: '850', start: '', end: '' },
  { mode: 'range', value: '', start: '1000', end: '500' },
];
const POINTS: [number, number][][] = [[], [[24.9384, 60.1699]], [[24.94, 60.17], [25.5, 61.25], [23.1, 62.8]]];
const POLYGONS: [number, number][][][] = [
  [],
  [[[24, 60], [25, 60], [25, 61], [24, 60]]],
  [[[24, 60], [25, 60], [25, 61], [24, 60]], [[20.123, 65.456], [21.5, 65.5], [21, 66], [20.123, 65.456]]],
];
const LOCATIONS = [null, { id: '658225' }, { id: 'x', properties: { href: 'https://example.org/edr/collections/c/locations/abc?f=json' } }];
const CUSTOM_DIMS: Record<string, DimSelection>[] = [{}, { member: { mode: 'individual', value: '5', start: '', end: '' } }];

describe('buildQueryUrl serializes exactly like the previous URL builder', () => {
  for (const [name, collection] of Object.entries(COLLECTIONS)) {
    // Corridor queries were sent without their geometry before; they're tested below
    for (const queryKey of Object.keys(collection.data_queries).filter(key => key !== 'corridor')) {
      it(`${name} / ${queryKey}`, () => {
        const baseUrl = normalizeHref(collection.data_queries[queryKey].link.href)!;
        const format = collection.data_queries[queryKey].link.variables?.output_formats?.[0] ?? '';
        let compared = 0;
        for (const datetime of DATETIMES) for (const vertical of VERTICALS) for (const points of POINTS)
        for (const polygons of POLYGONS) for (const location of LOCATIONS) for (const customDims of CUSTOM_DIMS)
        for (const [f, parameters] of [['', []], [format, ['Temperature', 'Humidity']]] as [string, string[]][]) {
          const input: QueryModelInput = {
            collection, queryKey, format: f, parameters, datetime, vertical, customDims, points, polygons,
            radius: { value: 25, units: 'km' }, queryParams: {}, locationFeature: location,
          };
          const model = buildQueryModel(input)!;
          const legacy = legacyBuildUrl(
            baseUrl, f, parameters, points, polygons, 25, queryKey, location,
            datetime.value, datetime.mode, datetime.start, datetime.end,
            vertical.value, vertical.mode, vertical.start, vertical.end,
            Object.fromEntries(Object.entries(customDims).map(([id, s]) => [id, s.value])),
            Object.fromEntries(Object.entries(customDims).map(([id, s]) => [id, s.mode])),
            Object.fromEntries(Object.entries(customDims).map(([id, s]) => [id, s.start])),
            Object.fromEntries(Object.entries(customDims).map(([id, s]) => [id, s.end])),
          );
          expect(buildQueryUrl(model)).toBe(legacy);
          compared++;
        }
        expect(compared).toBe(4 * 3 * 3 * 3 * 3 * 2 * 2);
      });
    }
  }
});

describe('buildQueryUrl', () => {
  const request = (queryKey: string, overrides: Partial<QueryModelInput>) => buildQueryUrl(buildQueryModel({
    collection: COLLECTIONS.fmiEcmwf, queryKey, format: 'CoverageJSON', parameters: [],
    datetime: emptyDim(), vertical: emptyDim(), customDims: {}, points: [[24.9384, 60.1699]], polygons: [],
    radius: { value: 10, units: 'km' }, queryParams: {}, locationFeature: null, ...overrides,
  })!)!;
  const position = (overrides: Partial<QueryModelInput>) => request('position', overrides);

  it('sends custom dimensions chosen as a range (dropped before the query model)', () => {
    const url = new URL(position({ customDims: { member: { mode: 'range', value: '', start: '1', end: '5' } } }));
    expect(url.searchParams.get('member')).toBe('1/5');
  });

  it('builds a position request', () => {
    expect(position({})).toBe('https://opendata.fmi.fi/edr/collections/ecmwf/position?f=CoverageJSON&coords=POINT%2824.938+60.170%29');
  });

  it('sends the radius in its unit', () => {
    const url = new URL(request('radius', { radius: { value: 500, units: 'm' } }));
    expect([url.searchParams.get('within'), url.searchParams.get('within-units')]).toEqual(['500', 'm']);
  });

  it('sends a corridor as its centre line plus the size parameters that are set', () => {
    const url = new URL(request('corridor', {
      points: [[24.9384, 60.1699], [25.5, 61.25]],
      queryParams: { 'corridor-width': '10', 'width-units': 'km', 'corridor-height': ' ', 'height-units': 'hPa', unrelated: 'x' },
    }));
    expect(url.searchParams.get('coords')).toBe('LINESTRING(24.938 60.170, 25.500 61.250)');
    expect(Object.fromEntries([...url.searchParams].filter(([name]) => name !== 'coords' && name !== 'f'))).toEqual({
      'corridor-width': '10', 'width-units': 'km', 'height-units': 'hPa',
    });
    expect(new URL(position({ queryParams: { 'corridor-width': '10' } })).searchParams.has('corridor-width')).toBe(false);
  });

  it('returns null for a query the collection does not offer', () => {
    expect(buildQueryModel({
      collection: COLLECTIONS.fmiEcmwf, queryKey: 'nope', format: '', parameters: [], datetime: emptyDim(),
      vertical: emptyDim(), customDims: {}, points: [], polygons: [], radius: { value: 10, units: 'km' }, queryParams: {}, locationFeature: null,
    })).toBeNull();
  });
});

describe('collectionBaseUrl', () => {
  it('strips data query parameters but keeps others', () => {
    expect(collectionBaseUrl('https://x.org/edr/collections/c?f=json&datetime=a&z=1&coords=POINT(1+2)&lang=fi'))
      .toBe('https://x.org/edr/collections/c?lang=fi');
  });
});
