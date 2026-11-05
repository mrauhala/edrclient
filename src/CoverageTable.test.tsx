import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { coverageColumns, coverageRows } from './CoverageTable';
import type { CoverageSeries } from './coverage/coverageSummary';

const figures = { label: null, count: 2, nulls: 0, others: 0, numbers: 2, min: 1, max: 2, mean: 1.5, notIncluded: false };
const SERIES: CoverageSeries = {
  times: [1, 2],
  rawTimes: ['2026-11-05T12:00:00+00:00', '2026-11-05T13:00:00.000000000'],
  locations: ['10, 50'],
  stepChanges: [],
  parameters: [
    { ...figures, id: 'a.b/c', unit: 'K', raw: [[268.7255147799975, null]], series: [[268.7255147799975, null]] },
    { ...figures, id: 'wx', unit: '', raw: [['rain', 0]], series: [[null, 0]] },
  ],
};
const TWO_PLACES: CoverageSeries = {
  ...SERIES,
  locations: ['10, 50', '12, 52'],
  parameters: [{ ...SERIES.parameters[0], raw: [[1, 2], [3, 4]], series: [[1, 2], [3, 4]] }],
};

describe('coverageColumns', () => {
  it('has a time, and a column per parameter with its unit', () => {
    expect(coverageColumns(SERIES).map(column => column.headerName)).toEqual(['Time', 'a.b/c (K)', 'wx']);
  });

  it('gives each a field of its own, whatever its id', () => {
    expect(coverageColumns(SERIES).map(column => column.field)).toEqual(['time', 'p0', 'p1']);
  });

  it('adds the location when there is more than one', () => {
    expect(coverageColumns(TWO_PLACES).map(column => column.headerName)).toEqual(['Time', 'Location', 'a.b/c (K)']);
  });

  it('is wide enough for the longest time and each header', () => {
    const [time, first, second] = coverageColumns(SERIES);
    expect(time.width).toBeGreaterThanOrEqual('2026-11-05T13:00:00.000000000'.length * 7);
    expect(first.minWidth).toBeGreaterThanOrEqual('a.b/c (K)'.length * 7);
    expect(second.minWidth).toBeLessThan(first.minWidth!);
  });

  it('shows a value exactly as sent, and marks a null', () => {
    const { renderCell } = coverageColumns(SERIES)[1];
    const cell = (value: unknown) => renderToStaticMarkup(<>{renderCell!({ value } as never)}</>);
    expect(cell(268.7255147799975)).toBe('268.7255147799975');
    expect(cell(0)).toBe('0');
    expect(cell('rain')).toBe('rain');
    expect(cell(null)).toContain('>null<');
    expect(cell(undefined)).toContain('>null<');
  });
});

describe('coverageRows', () => {
  it('has a row per time with the raw time and values', () => {
    expect(coverageRows(SERIES)).toEqual([
      { id: '0:0', time: '2026-11-05T12:00:00+00:00', location: '10, 50', p0: 268.7255147799975, p1: 'rain' },
      { id: '0:1', time: '2026-11-05T13:00:00.000000000', location: '10, 50', p0: null, p1: 0 },
    ]);
  });

  it('has a row per time for each location, each row with its own values', () => {
    const rows = coverageRows(TWO_PLACES);
    expect(rows.map(row => [row.id, row.location, row.p0])).toEqual([
      ['0:0', '10, 50', 1], ['0:1', '10, 50', 2], ['1:0', '12, 52', 3], ['1:1', '12, 52', 4],
    ]);
  });
});
