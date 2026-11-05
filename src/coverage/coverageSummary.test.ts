import { describe, expect, it } from 'vitest';
import { countText, describeTimes, formatValue, meanText, rangeText, stepRuns, summarizeCoverage } from './coverageSummary';

const hours = (from: number, count: number, step = 1) => Array.from({ length: count }, (_, i) => new Date(Date.UTC(2026, 10, 5, from + i * step)).toISOString().replace('.000', ''));
const axes = (t: string[], x = 10, y = 50) => ({ x: { values: [x] }, y: { values: [y] }, t: { values: t } });
const range = (values: unknown[]) => ({ type: 'NdArray', dataType: 'float', axisNames: ['t'], shape: [values.length], values });
const temperature = { type: 'Parameter', unit: { symbol: { value: 'K' } }, observedProperty: { label: { en: 'Air temperature' } } };

// As MeteoCore sends a position
const point = (values: unknown[], t: string[] = hours(0, values.length)) => ({
  type: 'Coverage',
  domain: { type: 'Domain', domainType: 'PointSeries', axes: axes(t) },
  parameters: { t2m: temperature },
  ranges: { t2m: range(values) },
});

// As it sends several: the parameters are the collection's, and each coverage is a place
const several = (t: string[], ...lines: unknown[][]) => ({
  type: 'CoverageCollection',
  domainType: 'PointSeries',
  parameters: { t2m: temperature },
  coverages: lines.map((values, i) => ({ type: 'Coverage', domain: { domainType: 'PointSeries', axes: axes(t, 10 + i, 50 + i) }, ranges: { t2m: range(values) } })),
});

describe('summarizeCoverage', () => {
  it('is only for CoverageJSON', () => {
    for (const json of [null, 'x', 1, [], {}, { type: 'FeatureCollection' }, { type: 'CoverageCollection' }]) {
      expect(summarizeCoverage(json)).toBeNull();
    }
  });

  describe('a time series at a point', () => {
    const summary = summarizeCoverage(point([270, 271, 275.5]))!;

    it('says what it is', () => {
      expect(summary.domainType).toBe('PointSeries');
      expect(summary.shape).toBe('1 point, 3 times, 1 parameter');
      expect(summary.timeText).toBe('Hourly, Nov 5 00:00 to Nov 5 02:00.');
    });

    it('gives the figures', () => {
      expect(summary.parameters[0]).toMatchObject({ id: 't2m', label: 'Air temperature', unit: 'K', count: 3, nulls: 0, min: 270, max: 275.5 });
      expect(summary.parameters[0].mean).toBeCloseTo(272.1667, 3);
    });

    it('holds the series', () => {
      expect(summary.series!.times).toEqual([Date.UTC(2026, 10, 5, 0), Date.UTC(2026, 10, 5, 1), Date.UTC(2026, 10, 5, 2)]);
      expect(summary.series!.rawTimes[0]).toBe('2026-11-05T00:00:00Z');
      expect(summary.series!.parameters[0].series).toEqual([[270, 271, 275.5]]);
    });

    it('has nothing to note', () => {
      expect(summary.notes).toEqual([]);
    });
  });

  it('counts more than one', () => {
    const json = { ...point([1, 2]), parameters: { t2m: temperature, b: temperature }, ranges: { t2m: range([1, 2]), b: range([1, 2]) } };
    expect(summarizeCoverage(json)!.shape).toBe('1 point, 2 times, 2 parameters');
  });

  it("calls a polygon's series what it is, as DWD sends them", () => {
    const summary = summarizeCoverage({
      type: 'Coverage',
      domain: { domainType: 'MultiPolygonSeries', axes: { composite: { values: [[[[0, 0]]]] }, t: { values: hours(0, 2) } } },
      ranges: { a: range([1, 2]) },
    })!;
    expect(summary.shape).toBe('1 polygon, 2 times, 1 parameter');
    expect(summary.series!.locations).toEqual(['Location 1']);
  });

  it('reads a time as pygeoapi writes it', () => {
    const t = ['2026-10-30T04:00:00.000000000', '2026-10-30T05:00:00.000000000'];
    expect(summarizeCoverage(point([1, 2], t))!.series!.times).toEqual([Date.UTC(2026, 9, 30, 4), Date.UTC(2026, 9, 30, 5)]);
  });

  it('reads a time as MeteoCore writes it', () => {
    expect(summarizeCoverage(point([1], ['2026-11-05T12:00:00+00:00']))!.series!.times).toEqual([Date.UTC(2026, 10, 5, 12)]);
  });

  it('has no second name when it would only repeat the id', () => {
    const json = point([1, 2]);
    json.parameters.t2m = { ...temperature, observedProperty: { label: { en: 't2m' } } };
    expect(summarizeCoverage(json)!.parameters[0].label).toBeNull();
  });

  it('has no unit where UCUM says there is none', () => {
    const json = point([1, 2]);
    json.parameters.t2m = { ...temperature, unit: { symbol: { value: '1' } } };
    expect(summarizeCoverage(json)!.parameters[0].unit).toBe('');
  });

  it('reads a single time', () => {
    const summary = summarizeCoverage(point([10.5]))!;
    expect(summary.shape).toBe('1 point, 1 time, 1 parameter');
    expect(summary.timeText).toBe('At Nov 5 00:00.');
    expect(summary.series!.times).toHaveLength(1);
  });

  describe('time steps', () => {
    const uneven = [...hours(0, 3), ...hours(5, 2, 3)];

    it('names each and says when it changes', () => {
      const summary = summarizeCoverage(point([1, 2, 3, 4, 5], uneven))!;
      expect(summary.timeText).toBe('Hourly to Nov 5 02:00, then 3-hourly.');
      expect(summary.series!.stepChanges).toEqual([{ at: Date.UTC(2026, 10, 5, 2), label: '3 h' }]);
    });

    it('points inside the first location that has that time', () => {
      const json = several(uneven, [1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
      expect(summarizeCoverage(json)!.notes[0].path).toBe('/coverages/0/domain/axes/t/values/2');
    });

    it('notes the change, pointing at the time it happens', () => {
      const { notes } = summarizeCoverage(point([1, 2, 3, 4, 5], uneven))!;
      expect(notes).toEqual([{ message: 'Time step changes from 1 h to 3 h at Nov 5 02:00', path: '/domain/axes/t/values/2', severity: 'info' }]);
    });

    it('stops naming them when there are too many', () => {
      const t = [0, 1, 3, 4, 7, 8, 12].map(h => new Date(Date.UTC(2026, 10, 5, h)).toISOString());
      const summary = summarizeCoverage(point([1, 2, 3, 4, 5, 6, 7], t))!;
      expect(summary.timeText).toBe('Irregular steps, Nov 5 00:00 to Nov 5 12:00.');
      expect(summary.series!.stepChanges).toEqual([]);
      expect(summary.notes).toHaveLength(1);
      expect(summary.notes[0]).toMatchObject({ message: 'Time step changes 5 times, first at Nov 5 01:00', path: '/domain/axes/t/values/1' });
    });
  });

  describe('nulls', () => {
    it('notes one, where it is', () => {
      const { notes, parameters } = summarizeCoverage(point([1, null, 3]))!;
      expect(parameters[0]).toMatchObject({ count: 3, nulls: 1, min: 1, max: 3, mean: 2 });
      expect(notes).toEqual([{ message: '1 null in t2m, at Nov 5 01:00', path: '/ranges/t2m/values/1', severity: 'info' }]);
    });

    it('notes several by the first', () => {
      expect(summarizeCoverage(point([1, null, null]))!.notes[0]).toMatchObject({ message: '2 nulls in t2m, first at Nov 5 01:00', path: '/ranges/t2m/values/1' });
    });

    it('notes all of them differently', () => {
      const summary = summarizeCoverage(point([null, null]))!;
      expect(summary.notes[0]).toMatchObject({ message: 'All 2 values of t2m are null', path: '/ranges/t2m/values/0' });
      expect(summary.parameters[0]).toMatchObject({ min: null, max: null, mean: null });
    });

    it('keeps them as gaps in the series', () => {
      expect(summarizeCoverage(point([1, null, 3]))!.series!.parameters[0].series).toEqual([[1, null, 3]]);
    });

    it('makes a pointer of any id', () => {
      const json = point([null, 1]);
      json.ranges = { 'a/b~c': json.ranges.t2m } as unknown as typeof json.ranges;
      expect(summarizeCoverage(json)!.notes[0].path).toBe('/ranges/a~1b~0c/values/0');
    });
  });

  describe('values that are not numbers', () => {
    const summary = summarizeCoverage(point(['a', 'b', 3]))!;

    it('counts them apart', () => {
      expect(summary.parameters[0]).toMatchObject({ count: 3, others: 2, numbers: 1, nulls: 0, min: 3, max: 3 });
    });

    it('leaves them out of the line, and keeps them for the table', () => {
      expect(summary.series!.parameters[0].series).toEqual([[null, null, 3]]);
      expect(summary.series!.parameters[0].raw).toEqual([['a', 'b', 3]]);
    });

    it("doesn't take infinity for a number", () => {
      expect(summarizeCoverage(point([Infinity, 1]))!.parameters[0]).toMatchObject({ others: 1, min: 1 });
    });
  });

  describe('several locations', () => {
    const t = hours(0, 3);
    const summary = summarizeCoverage(several(t, [1, 2, 3], [4, null, 6], [7, 8, 9]))!;

    it('counts the points, not the coverages, and takes the parameters from the collection', () => {
      expect(summary.shape).toBe('3 points, 3 times, 1 parameter');
      expect(summary.domainType).toBe('PointSeries');
      expect(summary.parameters[0]).toMatchObject({ label: 'Air temperature', unit: 'K' });
    });

    it('figures over all of them', () => {
      expect(summary.parameters[0]).toMatchObject({ count: 9, nulls: 1, min: 1, max: 9 });
      expect(summary.parameters[0].mean).toBe(5);
    });

    it('holds a line for each', () => {
      expect(summary.series!.locations).toEqual(['10, 50', '11, 51', '12, 52']);
      expect(summary.series!.parameters[0].series).toEqual([[1, 2, 3], [4, null, 6], [7, 8, 9]]);
    });

    it('says which one a note is about, and points inside it', () => {
      expect(summary.notes[0]).toMatchObject({ message: '1 null in t2m, at Nov 5 01:00 (11, 51)', path: '/coverages/1/ranges/t2m/values/1' });
    });

    it('lines times up when the locations have different ones', () => {
      const json = several(t, [1, 2, 3], [4, 5, 6]);
      json.coverages[1].domain.axes.t.values = hours(2, 3);
      const { series } = summarizeCoverage(json)!;
      expect(series!.times).toHaveLength(5);
      expect(series!.parameters[0].series).toEqual([[1, 2, 3, null, null], [null, null, 4, 5, 6]]);
    });

    it('puts times in order, whichever location has them', () => {
      const json = several(t, [1, 2, 3], [4, 5, 6]);
      json.coverages[0].domain.axes.t.values = hours(2, 3);
      json.coverages[1].domain.axes.t.values = hours(0, 3);
      const { series } = summarizeCoverage(json)!;
      expect(series!.times).toEqual([...series!.times].sort((a, b) => a - b));
      expect(series!.parameters[0].series).toEqual([[null, null, 1, 2, 3], [4, 5, 6, null, null]]);
    });

    it("takes the collection's domain type when the coverages don't say", () => {
      const json = several(t, [1, 2, 3]) as unknown as { coverages: { domain: { domainType?: string } }[] };
      delete json.coverages[0].domain.domainType;
      expect(summarizeCoverage(json)!.domainType).toBe('PointSeries');
    });

    it("prefers a coverage's own parameters", () => {
      const json = several(t, [1, 2, 3]) as { coverages: Record<string, unknown>[] };
      json.coverages[0].parameters = { t2m: { unit: { symbol: 'C' } } };
      expect(summarizeCoverage(json)!.parameters[0].unit).toBe('C');
    });

    it('takes a domain type from the coverages over the collection, and notices a mix', () => {
      const json = several(t, [1, 2, 3], [1, 2, 3]);
      json.coverages[1].domain.domainType = 'Grid';
      expect(summarizeCoverage(json)!.domainType).toBe('Mixed');
    });

    it('has nothing to show of an empty collection', () => {
      const empty = summarizeCoverage({ type: 'CoverageCollection', coverages: [] })!;
      expect(empty.series).toBeNull();
      expect(empty.shape).toBe('0 coverages, 0 parameters');
    });
  });

  describe('a grid', () => {
    const values = (start: number, count: number, step: number) => Array.from({ length: count }, (_, i) => start + i * step);
    // As MeteoCore sends an area: no time at all
    const grid = {
      type: 'Coverage',
      domain: {
        domainType: 'Grid',
        axes: { x: { values: values(24.03125, 16, 0.0625) }, y: { values: values(60.96875, 16, -0.0625) } },
        referencing: [{ coordinates: ['x', 'y'], system: { type: 'GeographicCRS', id: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } }],
      },
      parameters: { t2m: temperature },
      ranges: { t2m: range([1, null, 3, 4]) },
    };
    const summary = summarizeCoverage(grid)!;

    it('says its size and spacing', () => {
      expect(summary.domainType).toBe('Grid');
      expect(summary.shape).toBe('16 × 16 cells, every 0.0625°, 1 parameter');
      expect(summary.timeText).toBeNull();
    });

    it('says where it is, in the order it runs', () => {
      expect(summary.axes).toEqual(['x 24.03125 to 24.96875', 'y 60.96875 to 60.03125']);
    });

    it('has figures but no series', () => {
      expect(summary.series).toBeNull();
      expect(summary.parameters[0]).toMatchObject({ count: 4, nulls: 1, min: 1, max: 4 });
    });

    it('notes nulls without a time', () => {
      expect(summary.notes[0]).toMatchObject({ message: '1 null in t2m', path: '/ranges/t2m/values/1' });
    });

    it('gives no degrees without a coordinate system that has them', () => {
      expect(summarizeCoverage({ ...grid, domain: { ...grid.domain, referencing: [] } })!.shape).toContain('every 0.0625,');
      expect(summarizeCoverage({ ...grid, domain: { ...grid.domain, referencing: [{ system: { id: 'http://www.opengis.net/def/crs/EPSG/0/3857' } }] } })!.shape).toContain('every 0.0625,');
      expect(summarizeCoverage({ ...grid, domain: { ...grid.domain, referencing: [{ system: { id: 'EPSG:4326' } }] } })!.shape).toContain('every 0.0625°');
      expect(summarizeCoverage({ ...grid, domain: { ...grid.domain, referencing: [{ system: { type: 'GeographicCRS' } }] } })!.shape).toContain('every 0.0625°');
    });

    it('reads an axis written as start, stop and num', () => {
      const regular = { ...grid, domain: { domainType: 'Grid', axes: { x: { start: 0, stop: 10, num: 11 }, y: { start: 5, stop: 0, num: 21 } } } };
      const { shape, axes: spans } = summarizeCoverage(regular)!;
      expect(shape).toBe('11 × 21 cells, every 1 × 0.25, 1 parameter');
      expect(spans).toEqual(['x 0 to 10', 'y 5 to 0']);
    });

    it('leaves the spacing out when it varies', () => {
      const uneven = { ...grid, domain: { domainType: 'Grid', axes: { x: { values: [0, 1, 3] }, y: { values: [0, 1, 2] } } } };
      expect(summarizeCoverage(uneven)!.shape).toBe('3 × 3 cells, 1 parameter');
    });

    it('adds levels and times, and describes the times', () => {
      const cube = { ...grid, domain: { domainType: 'Grid', axes: { x: { values: [0, 1] }, y: { values: [0, 1] }, z: { values: [850, 500] }, t: { values: hours(0, 2) } } } };
      const result = summarizeCoverage(cube)!;
      expect(result.shape).toBe('2 × 2 cells, every 1, 2 levels, 2 times, 1 parameter');
      expect(result.timeText).toBe('Hourly, Nov 5 00:00 to Nov 5 01:00.');
    });

    it('writes large sizes so they can be read', () => {
      const big = { ...grid, domain: { domainType: 'Grid', axes: { x: { start: 0, stop: 1, num: 1200 }, y: { start: 0, stop: 1, num: 900 } } } };
      expect(summarizeCoverage(big)!.shape).toContain('1,200 × 900 cells');
    });

    it('has one shape to describe only with one coverage', () => {
      const result = summarizeCoverage({ type: 'CoverageCollection', coverages: [grid, grid] })!;
      expect(result.shape).toBe('2 coverages, 1 parameter');
      expect(result.axes).toEqual([]);
      expect(result.parameters[0].count).toBe(8);
      expect(result.notes[0].path).toBe('/coverages/0/ranges/t2m/values/1');
    });
  });

  describe('other shapes', () => {
    it('describes a point with no time', () => {
      const summary = summarizeCoverage({ type: 'Coverage', domain: { domainType: 'Point', axes: { x: { values: [1] }, y: { values: [2] } } }, ranges: { a: range([1]) } })!;
      expect(summary.series).toBeNull();
      expect(summary.shape).toBe('1 point, 1 parameter');
      expect(summary.axes).toEqual(['x 1', 'y 2']);
    });

    it('describes a trajectory', () => {
      const summary = summarizeCoverage({ type: 'Coverage', domain: { domainType: 'Trajectory', axes: { composite: { values: [[0, 1], [1, 2]] } } }, ranges: { a: range([1, 2]) } })!;
      expect(summary.domainType).toBe('Trajectory');
      expect(summary.shape).toBe('2 positions, 1 parameter');
    });

    it('describes a line along one axis', () => {
      const summary = summarizeCoverage({ type: 'Coverage', domain: { axes: { x: { values: [1, 2, 3] }, y: { values: [2] } } }, ranges: { a: range([1, 2, 3]) } })!;
      expect(summary.domainType).toBe('Coverage');
      expect(summary.shape).toBe('3 positions, 1 parameter');
    });

    it('says when a range is only a link', () => {
      const summary = summarizeCoverage({ type: 'Coverage', domain: { axes: { x: { values: [1, 2] }, y: { values: [1, 2] } } }, ranges: { a: 'https://example.com/a.json', b: { type: 'TiledNdArray' } } })!;
      expect(summary.parameters.map(p => p.notIncluded)).toEqual([true, true]);
      expect(countText(summary.parameters[0])).toBe("Values aren't in this response");
    });

    it('has no series when a time cannot be read', () => {
      expect(summarizeCoverage(point([1, 2], ['soon', 'later']))!.series).toBeNull();
    });
  });

  it.each([
    [{ type: 'Coverage' }],
    [{ type: 'Coverage', domain: 1, ranges: 'x', parameters: [] }],
    [{ type: 'Coverage', domain: { axes: null }, ranges: { a: null, b: 1, c: { values: 'x' } } }],
    [{ type: 'Coverage', domain: { axes: { t: { values: 'x' }, x: 1 } }, ranges: {} }],
    [{ type: 'Coverage', domain: { axes: { x: { values: [] }, y: { values: ['a'] } }, referencing: [null, 1, {}] }, ranges: {} }],
    [{ type: 'CoverageCollection', coverages: [null, 1, 'x', {}] }],
  ])('survives a malformed %j', json => {
    expect(summarizeCoverage(json)).toMatchObject({ series: null });
  });
});

describe('stepRuns', () => {
  it('finds stretches of the same step', () => {
    expect(stepRuns([0, 1, 2, 5, 8, 9])).toEqual([
      { step: 1, from: 0, to: 2 },
      { step: 3, from: 2, to: 8 },
      { step: 1, from: 8, to: 9 },
    ]);
  });

  it('has none with fewer than two', () => {
    expect(stepRuns([])).toEqual([]);
    expect(stepRuns([1])).toEqual([]);
  });
});

describe('describeTimes', () => {
  const MINUTE = 60000;
  const from = Date.UTC(2026, 10, 5);
  const every = (step: number) => [from, from + step];

  it('has nothing to say of no times', () => {
    expect(describeTimes([])).toBeNull();
  });

  it.each([
    [MINUTE, 'Every minute'],
    [MINUTE * 15, 'Every 15 min'],
    [MINUTE * 60, 'Hourly'],
    [MINUTE * 360, '6-hourly'],
    [MINUTE * 1440, 'Daily'],
    [MINUTE * 2880, 'Every 2 days'],
    [30000, 'Every 30 s'],
  ])('names a step of %d ms', (step, name) => {
    expect(describeTimes(every(step))).toMatch(new RegExp(`^${name}, Nov 5 00:00 to `));
  });

  it('names three stretches, and says where each ends but the last', () => {
    const h = 60 * MINUTE;
    expect(describeTimes([from, from + h, from + 4 * h, from + 7 * h, from + 13 * h])).toBe('Hourly to Nov 5 01:00, then 3-hourly to Nov 5 07:00, then 6-hourly.');
  });
});

describe('the words beside a parameter', () => {
  const figures = { id: 'a', label: null, unit: 'K', count: 3, nulls: 0, others: 0, numbers: 3, min: 1.5, max: 3, mean: 2.25, notIncluded: false };

  it('gives the range with its unit', () => {
    expect(rangeText(figures)).toBe('1.5 to 3 K');
    expect(rangeText({ ...figures, unit: '' })).toBe('1.5 to 3');
  });

  it('gives a single value once', () => {
    expect(rangeText({ ...figures, min: 3, max: 3 })).toBe('3 K');
    expect(meanText({ ...figures, min: 3, max: 3, mean: 3 })).toBeNull();
  });

  it('has none without numbers', () => {
    expect(rangeText({ ...figures, min: null, max: null })).toBeNull();
    expect(meanText({ ...figures, min: null, max: null, mean: null })).toBeNull();
  });

  it('gives the mean', () => {
    expect(meanText(figures)).toBe('mean 2.25');
  });

  it('counts, with what is odd', () => {
    expect(countText(figures)).toBe('3 values, 0 null');
    expect(countText({ ...figures, count: 11264, nulls: 1200 })).toBe('11,264 values, 1,200 null');
    expect(countText({ ...figures, others: 2 })).toBe('3 values, 0 null, 2 not a number');
    expect(countText({ ...figures, count: 1 })).toBe('1 value, 0 null');
  });

  it("shortens a value's digits, not its size", () => {
    expect(formatValue(268.7255147799975)).toBe('268.726');
    expect(formatValue(101325.4)).toBe('101325');
    expect(formatValue(1010.56)).toBe('1010.56');
    expect(formatValue(0.000123456789)).toBe('0.000123457');
    expect(formatValue(1234567)).toBe('1234570');
    expect(formatValue(0)).toBe('0');
  });
});
