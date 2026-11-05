import { describe, expect, it } from 'vitest';
import { coverageParameters, getTimeSeriesError, isTimeSeriesCoverage, parameterLabel, parameterUnit } from './coverageTimeSeries';
import dwdPosition from './__fixtures__/dwd-position-multipolygonseries.json';
import dwdArea from './__fixtures__/dwd-area-multipolygonseries.json';
import fmiPosition from './__fixtures__/fmi-position-pointseries.json';
import fmiLocation from './__fixtures__/fmi-location-pointseries-5d.json';
import hidrografico from './__fixtures__/hidrografico-collection-parameters.json';
import dmiPosition from './__fixtures__/dmi-position-grid.json';

const firstCoverage = (doc: { type: string; coverages?: unknown[] }) =>
  doc.type === 'CoverageCollection' ? doc.coverages![0] : doc;

describe('getTimeSeriesError', () => {
  it('accepts a MultiPolygonSeries with a single grid cell polygon (DWD position)', () => {
    expect(getTimeSeriesError(firstCoverage(dwdPosition))).toBeNull();
  });

  it('accepts PointSeries coverages (FMI)', () => {
    expect(getTimeSeriesError(fmiPosition)).toBeNull();
    expect(getTimeSeriesError(fmiLocation)).toBeNull();
  });

  it('rejects a MultiPolygonSeries with many polygons (DWD area) and names the axis', () => {
    expect(getTimeSeriesError(firstCoverage(dwdArea))).toMatch(/composite/);
  });

  it.each([
    ['single-point Grid', { domain: { axes: { x: { values: [1] }, y: { values: [2] }, t: { values: ['2026-01-01T00:00:00Z'] } } } }, null],
    ['regular axis with num 1', { domain: { axes: { x: { start: 1, stop: 1, num: 1 }, y: { values: [2] }, t: { values: ['a'] } } } }, null],
    ['Grid with several z levels', { domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2, 3] }, t: { values: ['a'] } } } }, /z/],
    ['vertical profile without t', { domain: { axes: { x: { values: [1] }, y: { values: [2] }, z: { values: [1, 2] } } } }, /time axis/],
    ['domain given by URL', { domain: 'http://example.com/domain' }, /axes/],
    ['null', null, /axes/],
  ])('%s', (_name, coverage, expected) => {
    const error = getTimeSeriesError(coverage);
    if (expected === null) {
      expect(error).toBeNull();
    } else {
      expect(error).toMatch(expected);
    }
    expect(isTimeSeriesCoverage(coverage)).toBe(expected === null);
  });
});

// Instituto Hidrográfico (tide_obs_nrt): the CoverageCollection defines parameters once, the coverages
// have only ranges, and the range lists only its t axis (x and y hold one value each)
describe('coverage collection parameters', () => {
  const [coverage] = hidrografico.coverages;

  it('charts a coverage whose range names only the t axis', () => {
    expect(isTimeSeriesCoverage(coverage)).toBe(true);
  });

  it("uses the collection's parameters when the coverage has none", () => {
    expect(coverage).not.toHaveProperty('parameters');
    const parameters = coverageParameters(coverage as { parameters?: Record<string, unknown> }, hidrografico.parameters);
    expect(parameters).toEqual(hidrografico.parameters);
    expect(Object.keys(parameters!)).toEqual(Object.keys(coverage.ranges));
  });

  it("keeps a coverage's own parameter definitions over the collection's", () => {
    const own = { t2m: { label: 'own' } };
    expect(coverageParameters({ parameters: own }, { t2m: { label: 'collection' }, rh: { label: 'collection' } }))
      .toEqual({ t2m: { label: 'own' }, rh: { label: 'collection' } });
    expect(coverageParameters({ parameters: own })).toEqual(own);
    expect(coverageParameters({})).toBeUndefined();
  });
});

describe('parameterLabel', () => {
  it("prefers the observed property's label, then the description, then the id", () => {
    expect(parameterLabel('t2m', { observedProperty: { label: { en: 'Air temperature' } }, description: { en: 'Temperature at 2 m' } })).toBe('Air temperature');
    expect(parameterLabel('t2m', { observedProperty: { label: { fi: 'Lämpötila' } } })).toBe('Lämpötila');
    expect(parameterLabel('t2m', { description: { en: 'Temperature at 2 m' } })).toBe('Temperature at 2 m');
    expect(parameterLabel('t2m', {})).toBe('t2m');
    expect(parameterLabel('t2m')).toBe('t2m');
  });

  it('skips labels that are links (DMI)', () => {
    expect(parameterLabel('dew-point-temperature-2m', dmiPosition.parameters['dew-point-temperature-2m'])).toBe('2 metre dewpoint temperature');
    expect(parameterLabel('x', { observedProperty: { label: { en: 'http://vocab.nerc.ac.uk/x' } } })).toBe('x');
  });

  it('skips blank labels', () => {
    expect(parameterLabel('x', { observedProperty: { label: { en: ' ' } }, description: { en: 'Wind speed' } })).toBe('Wind speed');
  });
});

describe('parameterUnit', () => {
  it('reads a symbol written either way', () => {
    expect(parameterUnit({ unit: { symbol: 'K' } })).toBe('K');
    expect(parameterUnit({ unit: { symbol: { value: 'K' } } })).toBe('K');
  });

  it('falls back on the label', () => {
    expect(parameterUnit({ unit: { label: { en: 'kelvin' } } })).toBe('kelvin');
    expect(parameterUnit({ unit: { label: { fi: 'kelviniä' } } })).toBe('kelviniä');
    expect(parameterUnit({ unit: { symbol: {}, label: { en: 'kelvin' } } })).toBe('kelvin');
  });

  it('has none without one, or where UCUM says so', () => {
    expect(parameterUnit(undefined)).toBe('');
    expect(parameterUnit({})).toBe('');
    expect(parameterUnit({ unit: { symbol: { value: '1' } } })).toBe('');
  });
});
