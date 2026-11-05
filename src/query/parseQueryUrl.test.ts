import { describe, expect, it } from 'vitest';
import type { Collection } from '../types/api';
import { buildQueryUrl } from './buildQueryUrl';
import { isForCollection, matchDataQuery, matchInstance, readQuerySelections } from './parseQueryUrl';
import { buildQueryModel, emptyDim, type QueryModelInput } from './queryModel';
import { readableUrl } from './requestUrl';
import fmiEcmwf from './__fixtures__/fmi-ecmwf.json';
import fmiPainepinta from './__fixtures__/fmi-ecmwf-painepinta.json';
import meteocoreObs from './__fixtures__/meteocore-fmi-obs.json';

const FMI = fmiEcmwf as unknown as Collection;
const LEVELS = fmiPainepinta as unknown as Collection;
const METEOCORE = meteocoreObs as unknown as Collection;

const hrefOf = (collection: Collection, queryKey: string) => collection.data_queries![queryKey].link!.href as string;

function built(collection: Collection, queryKey: string, overrides: Partial<QueryModelInput>): string {
  return readableUrl(buildQueryUrl(buildQueryModel({
    collection, queryKey, format: '', parameters: [], datetime: emptyDim(), vertical: emptyDim(), customDims: {},
    points: [], polygons: [], bbox: null, bboxAsCoords: false, radius: { value: 10, units: 'km' }, queryParams: {},
    locationFeature: null, ...overrides,
  })!)!);
}

const selections = (url: string, collection = FMI, queryKey = 'position') => readQuerySelections(url, collection, queryKey);
const withParams = (query: string, collection = FMI, queryKey = 'position') => selections(`${hrefOf(collection, queryKey)}?${query}`, collection, queryKey);

describe('matchDataQuery', () => {
  it('finds the query from the path', () => {
    expect(matchDataQuery(`${hrefOf(FMI, 'position')}?coords=POINT(1 2)`, FMI)).toEqual({ queryKey: 'position' });
    expect(matchDataQuery(hrefOf(FMI, 'area'), FMI)).toEqual({ queryKey: 'area' });
  });

  it('ignores a trailing slash', () => {
    expect(matchDataQuery(`${hrefOf(FMI, 'area')}/`, FMI)).toEqual({ queryKey: 'area' });
  });

  it('finds one location, decoded', () => {
    expect(matchDataQuery(`${hrefOf(FMI, 'locations')}/my%20place?f=x`, FMI)).toEqual({ queryKey: 'locations', locationId: 'my place' });
    expect(matchDataQuery(`${hrefOf(FMI, 'locations')}/a%E0%A4%A`, FMI)).toEqual({ queryKey: 'locations', locationId: 'a%E0%A4%A' });
  });

  it('matches a path however it is encoded', () => {
    const coded = {
      ...FMI,
      data_queries: { position: { link: { href: 'https://api.test/instances/2026-11-05T00:00:00Z/position', rel: 'data', variables: { query_type: 'position' } } } },
    } as unknown as Collection;
    expect(matchDataQuery('https://api.test/instances/2026-11-05T00%3A00%3A00Z/position?f=x', coded)).toEqual({ queryKey: 'position' });
  });

  it("doesn't take a path below another query, or below a location", () => {
    expect(matchDataQuery(`${hrefOf(FMI, 'position')}/more`, FMI)).toBeNull();
    expect(matchDataQuery(`${hrefOf(FMI, 'locations')}/a/b`, FMI)).toBeNull();
  });

  it("doesn't take another server, collection or anything else", () => {
    const here = new URL(hrefOf(FMI, 'position'));
    expect(matchDataQuery(`https://other.test${here.pathname}`, FMI)).toBeNull();
    expect(matchDataQuery(hrefOf(METEOCORE, 'position'), FMI)).toBeNull();
    expect(matchDataQuery('not a url', FMI)).toBeNull();
    expect(matchDataQuery('', FMI)).toBeNull();
  });

  it('copes with a collection without queries', () => {
    expect(matchDataQuery(hrefOf(FMI, 'position'), { ...FMI, data_queries: undefined } as unknown as Collection)).toBeNull();
  });
});

describe('matchInstance', () => {
  const WITH_INSTANCES = {
    ...FMI,
    data_queries: {
      ...FMI.data_queries,
      runs: { link: { href: 'https://api.test/collections/c/instances', rel: 'data', variables: { query_type: 'instances' } } },
    },
  } as unknown as Collection;

  it('finds the instance and the query that lists them', () => {
    expect(matchInstance('https://api.test/collections/c/instances/2026-11-05T00%3A00%3A00Z/position?f=x', WITH_INSTANCES))
      .toEqual({ queryKey: 'runs', instanceId: '2026-11-05T00:00:00Z', hasQuery: true });
    expect(matchInstance('https://api.test/collections/c/instances/run1', WITH_INSTANCES)).toEqual({ queryKey: 'runs', instanceId: 'run1', hasQuery: false });
  });

  it('looks only below the query that lists instances', () => {
    expect(matchInstance(`${hrefOf(FMI, 'position')}/run1`, WITH_INSTANCES)).toBeNull();
  });

  it('wants an instance, not just the list', () => {
    expect(matchInstance('https://api.test/collections/c/instances', WITH_INSTANCES)).toBeNull();
    expect(matchInstance(hrefOf(FMI, 'position'), WITH_INSTANCES)).toBeNull();
    expect(matchInstance('not a url', WITH_INSTANCES)).toBeNull();
  });

  it('counts both for the collection', () => {
    expect(isForCollection('https://api.test/collections/c/instances/run1', WITH_INSTANCES)).toBe(true);
    expect(isForCollection(hrefOf(FMI, 'position'), WITH_INSTANCES)).toBe(true);
    expect(isForCollection('https://other.test/x', WITH_INSTANCES)).toBe(false);
  });
});

describe('readQuerySelections', () => {
  it('reads back what the form builds, for each query type', () => {
    const point: [number, number] = [24.94, 60.17];
    const berlin: [number, number] = [13.4, 52.5];
    const square: [number, number][] = [[24, 60], [25, 60], [25, 61], [24, 60]];
    const other: [number, number][] = [[10, 50], [11, 50], [11, 51], [10, 50]];

    expect(selections(built(FMI, 'position', { points: [point] })).points).toEqual([point]);
    expect(selections(built(FMI, 'position', { points: [point, berlin] })).points).toEqual([point, berlin]);
    expect(selections(built(FMI, 'radius', { points: [point], radius: { value: 25, units: 'km' } }), FMI, 'radius'))
      .toMatchObject({ points: [point], radius: 25, radiusUnits: 'km' });
    expect(selections(built(FMI, 'trajectory', { points: [point, berlin] }), FMI, 'trajectory').points).toEqual([point, berlin]);
    expect(selections(built(FMI, 'area', { polygons: [square] }), FMI, 'area').polygons).toEqual([square]);
    expect(selections(built(FMI, 'area', { polygons: [square, other] }), FMI, 'area').polygons).toEqual([square, other]);
    expect(selections(built(METEOCORE, 'items', { bbox: [1, 2, 3, 4], queryParams: { limit: '50' } }), METEOCORE, 'items'))
      .toMatchObject({ bbox: [1, 2, 3, 4], queryParams: { limit: '50' } });
  });

  it('reads the form\'s choices back', () => {
    const url = built(FMI, 'position', {
      format: 'CoverageJSON', parameters: ['a', 'b'],
      datetime: { mode: 'range', value: '', start: '2026-11-05T00:00:00Z', end: '2026-11-06T00:00:00Z' },
    });
    expect(selections(url)).toMatchObject({
      format: 'CoverageJSON', parameters: ['a', 'b'],
      datetime: { mode: 'range', start: '2026-11-05T00:00:00Z', end: '2026-11-06T00:00:00Z' },
    });
  });

  it('reads a level, single or as a range', () => {
    expect(withParams('z=850', LEVELS).vertical).toEqual({ mode: 'individual', value: '850', start: '', end: '' });
    expect(withParams('z=500/850', LEVELS).vertical).toEqual({ mode: 'range', value: '', start: '500', end: '850' });
  });

  it('takes the time as typed, including an open-ended interval', () => {
    expect(withParams('datetime=2026-11-05T00:00:00Z').datetime).toMatchObject({ mode: 'individual', value: '2026-11-05T00:00:00Z' });
    expect(withParams('datetime=../2026-11-05T00:00:00Z').datetime).toMatchObject({ mode: 'range', start: '..', end: '2026-11-05T00:00:00Z' });
  });

  it('leaves no time when there is none', () => {
    expect(withParams('f=x').datetime).toEqual(emptyDim());
  });

  it('keeps a value with too many slashes whole, for the check to flag', () => {
    expect(withParams('datetime=a/b/c').datetime).toMatchObject({ mode: 'individual', value: 'a/b/c' });
  });

  it('reads custom dimensions it knows about, and no others', () => {
    const custom = { ...FMI, extent: { ...FMI.extent, custom: [{ id: 'member' }, { id: 'absent' }] } } as unknown as Collection;
    const { customDims } = withParams('member=1/3&nope=9', custom);
    expect(customDims).toEqual({ member: { mode: 'range', value: '', start: '1', end: '3' } });
  });

  it('keeps an unknown parameter name, which the form flags', () => {
    expect(withParams('parameter-name=nope,%20temperature,,').parameters).toEqual(['nope', 'temperature']);
    expect(withParams('f=x').parameters).toEqual([]);
  });

  it('takes a format it doesn\'t offer, which the form flags', () => {
    expect(withParams('f=garbage').format).toBe('garbage');
    expect(withParams('a=b').format).toBe('');
  });

  it.each([
    ['POINT(1 2)', [[1, 2]]],
    ['point ( 1.5  -2.5 )', [[1.5, -2.5]]],
    ['POINT(.5 1e1)', [[0.5, 10]]],
    ['MULTIPOINT((1 2),(3 4))', [[1, 2], [3, 4]]],
    ['MULTIPOINT(1 2, 3 4)', [[1, 2], [3, 4]]],
  ])('reads %s', (coords, points) => {
    expect(withParams(`coords=${encodeURIComponent(coords)}`).points).toEqual(points);
  });

  it.each(['garbage', 'POINT(1)', 'POINT(1 2 3)', 'POINT(a b)', 'POINT Z(1 2 3)', 'POLYGON((1 2,3 4,5 6,1 2))', 'LINESTRING(1 2, 3 4)', ''])(
    'leaves "%s" to the URL on a position query', coords => {
      expect(withParams(`coords=${encodeURIComponent(coords)}`).points).toEqual([]);
    });

  it('takes only a line for a trajectory', () => {
    const line = (coords: string) => withParams(`coords=${encodeURIComponent(coords)}`, FMI, 'trajectory').points;
    expect(line('LINESTRING(1 2, 3 4)')).toEqual([[1, 2], [3, 4]]);
    expect(line('POINT(1 2)')).toEqual([]);
    expect(line('LINESTRINGZ(1 2 3, 4 5 6)')).toEqual([]);
  });

  it('takes only polygons for an area, without holes', () => {
    const area = (coords: string) => withParams(`coords=${encodeURIComponent(coords)}`, FMI, 'area').polygons;
    const ring = [[1, 2], [3, 4], [5, 6], [1, 2]];
    expect(area('POLYGON((1 2,3 4,5 6,1 2))')).toEqual([ring]);
    expect(area('MULTIPOLYGON(((1 2,3 4,5 6,1 2)),((1 2,3 4,5 6,1 2)))')).toEqual([ring, ring]);
    expect(area('POLYGON((1 2,3 4,5 6,1 2),(2 3,3 3,3 4,2 3))')).toEqual([]);
    expect(area('MULTIPOLYGON(((1 2,3 4,5 6,1 2),(2 3,3 3,3 4,2 3)))')).toEqual([]);
    expect(area('MULTIPOLYGON(((1 2,3 4,5 6,1 2)),((1 2,3 4,5 6,1 2),(2 3,3 3,3 4,2 3)))')).toEqual([]);
    expect(area('MULTIPOLYGON(())')).toEqual([]);
    expect(area('MULTIPOLYGON(((1 2,bad)))')).toEqual([]);
    expect(area('POINT(1 2)')).toEqual([]);
  });

  it('takes geometry only for a query that has it', () => {
    expect(withParams('coords=POINT(1%202)', FMI, 'locations').points).toEqual([]);
    expect(withParams(`coords=${encodeURIComponent('POLYGON((1 2,3 4,5 6,1 2))')}`).polygons).toEqual([]);
    expect(withParams('bbox=1,2,3,4').bbox).toBeNull();
  });

  it('takes a box of four numbers', () => {
    const box = (bbox: string) => withParams(`bbox=${bbox}`, METEOCORE, 'items').bbox;
    expect(box('1,2,3,4')).toEqual([1, 2, 3, 4]);
    expect(box('1,2,3')).toBeNull();
    expect(box('1,2,3,4,5,6')).toBeNull();
    expect(box('a,2,3,4')).toBeNull();
  });

  it('notes a box also sent as coords', () => {
    expect(withParams('bbox=1,2,3,4&coords=x', METEOCORE, 'items').bboxAsCoords).toBe(true);
    expect(withParams('bbox=1,2,3,4', METEOCORE, 'items').bboxAsCoords).toBe(false);
    expect(withParams('coords=x').bboxAsCoords).toBe(false);
  });

  it('takes a radius only if it can hold it', () => {
    const radius = (query: string) => withParams(query, FMI, 'radius');
    expect(radius('within=25&within-units=km')).toMatchObject({ radius: 25, radiusUnits: 'km' });
    expect(radius('within=abc&within-units=parsecs')).toMatchObject({ radius: null, radiusUnits: null });
    expect(radius('within=&within-units=')).toMatchObject({ radius: null, radiusUnits: null });
    expect(radius('a=b')).toMatchObject({ radius: null, radiusUnits: null });
    expect(radius('within=0')).toMatchObject({ radius: 0 });
  });

  it('takes any unit when the query lists none', () => {
    const bare = { ...FMI, data_queries: { radius: { link: { ...FMI.data_queries!.radius.link, variables: { query_type: 'radius' } } } } } as unknown as Collection;
    expect(withParams('within-units=parsecs', bare, 'radius').radiusUnits).toBe('parsecs');
  });

  it("reads a query type's own parameters, blank when left out", () => {
    expect(withParams('corridor-width=5&width-units=km', FMI, 'corridor').queryParams).toEqual({
      'corridor-width': '5', 'width-units': 'km', 'corridor-height': '', 'height-units': '',
    });
    expect(withParams('limit=7', METEOCORE, 'items').queryParams).toEqual({ limit: '7' });
    expect(withParams('limit=7').queryParams).toEqual({});
  });
});
