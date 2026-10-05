import { describe, expect, it } from 'vitest';
import type { Collection } from '../types/api';
import { buildQueryModel, emptyDim, type QueryModelInput } from './queryModel';
import { addApiDocsIssues, summarizeIssues, validateQuery } from './validateQuery';
import type { QueryIssue } from './types';
import fmiEcmwf from './__fixtures__/fmi-ecmwf.json';
import fmiPainepinta from './__fixtures__/fmi-ecmwf-painepinta.json';
import dwdIcon from './__fixtures__/dwd-icon-d2-ruc-single-level.json';
import meteocoreObs from './__fixtures__/meteocore-fmi-obs.json';

const FMI = fmiEcmwf as unknown as Collection;
const FMI_LEVELS = fmiPainepinta as unknown as Collection;
const DWD = dwdIcon as unknown as Collection;
const METEOCORE = meteocoreObs as unknown as Collection;

const HELSINKI: [number, number] = [24.94, 60.17];
const BERLIN: [number, number] = [13.4, 52.5];

function issuesFor(collection: Collection, queryKey: string, overrides: Partial<QueryModelInput> = {}) {
  const model = buildQueryModel({
    collection, queryKey, format: 'CoverageJSON', parameters: [], datetime: emptyDim(), vertical: emptyDim(),
    customDims: {}, points: [], polygons: [], radius: { value: 10, units: 'km' }, locationFeature: null, ...overrides,
  });
  return validateQuery(model!);
}

// Issues other than notes, as "severity field: message" for readable assertions
const problems = (issues: ReturnType<typeof validateQuery>) =>
  issues.filter(issue => issue.severity !== 'info').map(issue => `${issue.severity} ${issue.field}`);
const ids = (issues: ReturnType<typeof validateQuery>) => issues.map(issue => issue.id);

describe('EDR geometry rules', () => {
  it('position needs a point, picked on the map', () => {
    const issues = issuesFor(FMI, 'position');
    expect(problems(issues)).toEqual(['missing coords']);
    expect(issues[0]).toMatchObject({ input: 'map', source: 'edr', message: 'Click a point on the map' });
    expect(problems(issuesFor(FMI, 'position', { points: [HELSINKI] }))).toEqual([]);
  });

  it('warns about points outside the collection spatial extent', () => {
    expect(problems(issuesFor(DWD, 'position', { points: [BERLIN] }))).toEqual([]);
    expect(problems(issuesFor(DWD, 'position', { points: [BERLIN, HELSINKI] }))).toEqual(['warning coords']);
  });

  it('trajectory needs at least 2 points', () => {
    expect(problems(issuesFor(FMI, 'trajectory', { points: [HELSINKI] }))).toEqual(['missing coords']);
    expect(problems(issuesFor(FMI, 'trajectory', { points: [HELSINKI, [25, 61]] }))).toEqual([]);
  });

  it('area needs a polygon with at least 3 corners', () => {
    expect(problems(issuesFor(FMI, 'area'))).toEqual(['missing coords']);
    expect(problems(issuesFor(FMI, 'area', { polygons: [[[24, 60], [25, 61], [24, 60]]] }))).toEqual(['error coords']);
    expect(problems(issuesFor(FMI, 'area', { polygons: [[[24, 60], [25, 60], [25, 61], [24, 60]]] }))).toEqual([]);
  });

  it('radius checks the radius and its unit against within_units', () => {
    expect(problems(issuesFor(FMI, 'radius', { points: [HELSINKI] }))).toEqual([]);
    expect(problems(issuesFor(FMI, 'radius', { points: [HELSINKI], radius: { value: 0, units: 'km' } }))).toEqual(['error within']);
    const wrongUnit = issuesFor(FMI, 'radius', { points: [HELSINKI], radius: { value: 5, units: 'm' } });
    expect(problems(wrongUnit)).toEqual(['error within-units']);
    expect(wrongUnit[0].message).toContain('km, mi');
    expect(problems(issuesFor(DWD, 'radius', { points: [BERLIN], radius: { value: 5, units: 'm' } }))).toEqual([]);
  });

  it('flags query types the builder cannot fill yet', () => {
    expect(problems(issuesFor(FMI_LEVELS, 'cube'))).toEqual(['warning bbox']);
    expect(problems(issuesFor(FMI, 'corridor'))).toEqual(['warning coords']);
    expect(ids(issuesFor(METEOCORE, 'items', { format: 'GeoJSON' }))).toContain('edr:query:list');
    expect(ids(issuesFor(FMI, 'instances'))).toContain('edr:query:list');
  });

  it('notes that a locations request without a location lists them all', () => {
    expect(ids(issuesFor(FMI, 'locations'))).toContain('edr:location:list');
    expect(ids(issuesFor(FMI, 'locations', { locationFeature: { id: '658225' } }))).not.toContain('edr:location:list');
  });
});

describe('collection metadata checks', () => {
  it('checks the output format and notes the server default when none is chosen', () => {
    expect(problems(issuesFor(FMI, 'position', { points: [HELSINKI], format: 'NetCDF' }))).toEqual(['error f']);
    const unset = issuesFor(FMI, 'position', { points: [HELSINKI], format: '' }).find(issue => issue.field === 'f');
    expect(unset).toMatchObject({ severity: 'info', message: expect.stringContaining('CoverageJSON') });
  });

  it('checks parameter names and notes when none are chosen', () => {
    const issues = issuesFor(FMI, 'position', { points: [HELSINKI], parameters: ['humidity', 'Bogus'] });
    expect(problems(issues)).toEqual(['error parameter-name']);
    expect(issues[0].message).toBe('Unknown parameter: Bogus');
    expect(ids(issuesFor(FMI, 'position', { points: [HELSINKI] }))).toContain('metadata:parameter-name:all');
    expect(ids(issuesFor(FMI, 'locations'))).not.toContain('metadata:parameter-name:all');
  });

  it('checks the datetime: complete ranges, valid values, order and extent', () => {
    const at = (datetime: QueryModelInput['datetime']) => problems(issuesFor(FMI, 'position', { points: [HELSINKI], datetime }));
    expect(at({ mode: 'individual', value: '2026-10-06T12:00:00Z', start: '', end: '' })).toEqual([]);
    expect(at({ mode: 'range', value: '', start: '2026-10-06T00:00:00Z', end: '' })).toEqual(['missing datetime']);
    expect(at({ mode: 'individual', value: 'yesterday', start: '', end: '' })).toEqual(['error datetime']);
    expect(at({ mode: 'range', value: '', start: '2026-10-08T00:00:00Z', end: '2026-10-06T00:00:00Z' })).toEqual(['error datetime']);
    expect(at({ mode: 'individual', value: '2025-01-01T00:00:00Z', start: '', end: '' })).toEqual(['warning datetime']);
    // Extent bounds with +00:00 offsets (MeteoCore)
    expect(problems(issuesFor(METEOCORE, 'position', {
      points: [HELSINKI], datetime: { mode: 'individual', value: '2026-10-01T00:00:00Z', start: '', end: '' },
    }))).toEqual([]);
  });

  it('checks vertical levels against the listed levels and the interval', () => {
    const at = (vertical: QueryModelInput['vertical']) => problems(issuesFor(FMI_LEVELS, 'position', { points: [HELSINKI], vertical }));
    expect(at({ mode: 'individual', value: '850', start: '', end: '' })).toEqual([]);
    expect(at({ mode: 'individual', value: '851', start: '', end: '' })).toEqual(['error z']);
    expect(at({ mode: 'individual', value: 'high', start: '', end: '' })).toEqual(['error z']);
    expect(at({ mode: 'range', value: '', start: '300', end: '' })).toEqual(['missing z']);
    expect(at({ mode: 'range', value: '', start: '200', end: '2000' })).toEqual(['warning z']);
    expect(at({ mode: 'range', value: '', start: '1000', end: '500' })).toEqual([]);
  });

  it('asks for both ends of a custom dimension range', () => {
    const issues = issuesFor(FMI, 'position', {
      points: [HELSINKI], customDims: { member: { mode: 'range', value: '', start: '1', end: '' } },
    });
    expect(problems(issues)).toEqual(['missing dim:member']);
  });
});

describe('ordering and summary', () => {
  it('sorts issues missing, error, warning, info and summarizes them', () => {
    const issues = issuesFor(DWD, 'area', {
      format: 'NetCDF', polygons: [[[24, 60], [25, 61], [24, 60]]],
      datetime: { mode: 'range', value: '', start: '2026-10-05T12:00:00Z', end: '' },
    });
    const order = issues.map(issue => issue.severity);
    expect(order).toEqual([...order].sort((a, b) => ['missing', 'error', 'warning', 'info'].indexOf(a) - ['missing', 'error', 'warning', 'info'].indexOf(b)));
    expect(summarizeIssues(issues)).toMatchObject({ missing: 1, needsAttention: true });
    expect(summarizeIssues([])).toEqual({ missing: 0, error: 0, warning: 0, info: 0, needsAttention: false });
  });
});

describe('addApiDocsIssues', () => {
  const model = (overrides: Partial<QueryModelInput> = {}) => buildQueryModel({
    collection: FMI, queryKey: 'position', format: 'CoverageJSON', parameters: [], datetime: emptyDim(), vertical: emptyDim(),
    customDims: {}, points: [HELSINKI], polygons: [], radius: { value: 10, units: 'km' }, locationFeature: null, ...overrides,
  })!;
  const apiIssue = (field: string, severity: QueryIssue['severity'] = 'warning'): QueryIssue => ({
    id: `openapi:${field}:rule`, severity, source: 'openapi', field, message: `about ${field}`, pointer: '/paths',
  });

  it('places API docs issues on the builder fields they concern', () => {
    const issues = addApiDocsIssues(
      model({ customDims: { member: { mode: 'individual', value: '1', start: '', end: '' } } }),
      [], [apiIssue('member'), apiIssue('f'), apiIssue('coords'), apiIssue('query', 'info')],
    );
    expect(issues.map(issue => [issue.id, issue.field, issue.input])).toEqual([
      ['openapi:dim:member:rule', 'dim:member', 'form'],
      ['openapi:f:rule', 'f', 'form'],
      ['openapi:coords:rule', 'coords', undefined],
      ['openapi:query:rule', 'query', undefined],
    ]);
  });

  it("leaves a field to EDR and the metadata when they already flag it, but not when they only note it", () => {
    const own = issuesFor(FMI, 'position', { format: 'NetCDF4' }); // missing coords, f not offered
    const merged = addApiDocsIssues(model({ format: 'NetCDF4', points: [] }), own, [apiIssue('coords'), apiIssue('f'), apiIssue('parameter-name')]);
    expect(merged.filter(issue => issue.source === 'openapi').map(issue => issue.field)).toEqual(['parameter-name']);
    expect(own.some(issue => issue.field === 'parameter-name' && issue.severity === 'info')).toBe(true);
  });

  it('keeps the severity order, with the query\'s own issues first', () => {
    const own = issuesFor(FMI, 'position', { points: [HELSINKI], datetime: { mode: 'range', value: '', start: '2026-10-05T12:00:00Z', end: '' } });
    const merged = addApiDocsIssues(model(), own, [apiIssue('query', 'info'), apiIssue('parameter-name')]);
    expect(merged.map(issue => `${issue.severity} ${issue.source}`)).toEqual([
      'missing metadata', 'warning openapi', ...own.filter(issue => issue.severity === 'info').map(issue => `info ${issue.source}`), 'info openapi',
    ]);
  });
});
