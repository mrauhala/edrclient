import { describe, expect, it } from 'vitest';
import { getTimeSeriesError, isTimeSeriesCoverage } from './coverageTimeSeries';
import dwdPosition from './__fixtures__/dwd-position-multipolygonseries.json';
import dwdArea from './__fixtures__/dwd-area-multipolygonseries.json';
import fmiPosition from './__fixtures__/fmi-position-pointseries.json';
import fmiLocation from './__fixtures__/fmi-location-pointseries-5d.json';

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
