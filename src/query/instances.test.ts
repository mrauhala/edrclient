import { describe, expect, it } from 'vitest';
import { instanceStep, instanceUrl, sortInstancesNewestFirst, type Instance } from './instances';
import { buildQueryModel, emptyDim } from './queryModel';
import { buildQueryUrl } from './buildQueryUrl';
import { validateQuery } from './validateQuery';

const FMI_LIST = 'https://opendata.fmi.fi/edr/collections/ecmwf/instances';
const MC_LIST = 'https://meteocore.app.meteo.fi/edr/collections/dwd-icon-eu/instances';

// Shaped like FMI's ecmwf instances (2026-10-06): no links, absolute data query hrefs, own metadata
function fmiInstance(id: string, start: string): Instance {
  const query = (type: string) => ({ link: { href: `${FMI_LIST}/${id}/${type}`, rel: 'data', variables: { query_type: type, output_formats: ['CoverageJSON'] } } });
  return {
    id, title: `Origintime: ${id}`, links: [], crs: [], output_formats: null,
    extent: { spatial: { bbox: [[-180, -90, 180, 90]], crs: 'OGC:CRS84' }, temporal: { interval: [[start, '2026-10-15T00:00:00Z']] } },
    parameter_names: { Temperature: { type: 'Parameter' } },
    data_queries: { position: query('position'), locations: query('locations') },
  } as unknown as Instance;
}

// Shaped like MeteoCore's: ids with ':', a self link
function meteocoreInstance(id: string): Instance {
  return {
    id, links: [{ rel: 'self', href: `${MC_LIST}/${id}` }], crs: [], output_formats: null,
    extent: { temporal: { interval: [[id, null]] } }, data_queries: {},
  } as unknown as Instance;
}

describe('instances', () => {
  it('sorts the latest run first, by when its data starts, then by id', () => {
    const runs = [fmiInstance('20261005T000000', '2026-10-05T03:00:00Z'), fmiInstance('20261006T000000', '2026-10-06T03:00:00Z'),
      fmiInstance('20261005T120000', '2026-10-05T15:00:00Z')];
    expect(sortInstancesNewestFirst(runs).map(run => run.id)).toEqual(['20261006T000000', '20261005T120000', '20261005T000000']);
    const undated = [{ id: '2022070912', data_queries: {} }, { id: '2022071000', data_queries: {} }] as unknown as Instance[];
    expect(sortInstancesNewestFirst(undated).map(run => run.id)).toEqual(['2022071000', '2022070912']);
  });

  it("addresses an instance by its self link, else by its id under the list", () => {
    expect(instanceUrl(meteocoreInstance('2026-10-06T00:00:00Z'), MC_LIST)).toBe(`${MC_LIST}/2026-10-06T00:00:00Z`);
    expect(instanceUrl(fmiInstance('20261006T000000', '2026-10-06T03:00:00Z'), `${FMI_LIST}/?f=json`))
      .toBe(`${FMI_LIST}/20261006T000000`);
  });

  it('lists the instances until one is picked, then asks for a query on it', () => {
    expect(instanceStep(FMI_LIST, null)).toMatchObject({ url: FMI_LIST, issues: [{ id: 'edr:instance:list', severity: 'info' }] });
    expect(instanceStep(FMI_LIST, fmiInstance('20261006T000000', '2026-10-06T03:00:00Z')))
      .toMatchObject({ url: `${FMI_LIST}/20261006T000000`, issues: [{ field: 'instance-query', severity: 'missing' }] });
  });

  it("builds and validates an instance's query against the instance", () => {
    const instance = fmiInstance('20261006T000000', '2026-10-06T03:00:00Z');
    const model = (queryKey: string, overrides = {}) => buildQueryModel({
      collection: instance, queryKey, format: 'CoverageJSON', parameters: ['Temperature'], datetime: emptyDim(), vertical: emptyDim(),
      customDims: {}, points: [[24.94, 60.17]], polygons: [], bbox: null, bboxAsCoords: false, radius: { value: 10, units: 'km' },
      queryParams: {}, locationFeature: null, ...overrides,
    })!;
    expect(buildQueryUrl(model('position')))
      .toBe(`${FMI_LIST}/20261006T000000/position?f=CoverageJSON&parameter-name=Temperature&coords=POINT%2824.940+60.170%29`);
    expect(validateQuery(model('position', { parameters: ['Humidity'] })).map(issue => issue.id)).toContain('metadata:parameter-name:offered');
    // A location is addressed by id under the instance's locations
    expect(buildQueryUrl(model('locations', { locationFeature: { id: '658225' } }))).toMatch(`${FMI_LIST}/20261006T000000/locations/658225?`);
  });
});
