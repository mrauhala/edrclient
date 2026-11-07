import { describe, expect, it } from 'vitest';
import { axisDrift, axisValues, invMercY, mercY, readCells, stepsOfSlice, MOST_VALUES_DRAWN, type DrawableCells, type GridGeometry, type SamplesGeometry, type PolygonsGeometry, type UndrawableCells } from './coverageCells';
import { CRS84, counting, grid, pointCollection, pointCoverage, pointLattice, triangles } from './cellsTestData';
import dmiPosition from '../utils/__fixtures__/dmi-position-grid.json';
import dwdArea from '../utils/__fixtures__/dwd-area-multipolygonseries.json';
import fmiPosition from '../utils/__fixtures__/fmi-position-pointseries.json';
import fmiSeries from '../utils/__fixtures__/fmi-location-pointseries-5d.json';
import hidrografico from '../utils/__fixtures__/hidrografico-collection-parameters.json';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const drawn = (json: unknown, options?: { drawAnyway?: boolean }) => {
  const reading = readCells(json, options);
  if (!reading.drawable) throw new Error(`Not drawable: ${reading.reason}`);
  return reading;
};
const refused = (json: unknown) => {
  const reading = readCells(json);
  if (reading.drawable) throw new Error('It was drawable');
  return reading as UndrawableCells;
};
const asGrid = (cells: DrawableCells) => cells.geometry as GridGeometry;
const notesOf = (cells: DrawableCells) => cells.notes.map(note => note.text);
const DAY = ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z', '2026-11-07T08:00:00Z'];

// The values of a range moved to another axis order, with the same cell under the same place
function permuted(json: Json, id: string, order: string[]): Json {
  const out = clone(json);
  const range = out.ranges[id];
  const names: string[] = range.axisNames;
  const shape: number[] = range.shape;
  const newShape = order.map(name => shape[names.indexOf(name)]);
  const strides = (axes: string[], sizes: number[]) => {
    const all: Record<string, number> = {};
    let stride = 1;
    for (let i = axes.length - 1; i >= 0; i--) {
      all[axes[i]] = stride;
      stride *= sizes[i];
    }
    return all;
  };
  const before = strides(names, shape);
  const after = strides(order, newShape);
  const values = new Array(range.values.length);
  const walk = (d: number, from: number, to: number) => {
    if (d === names.length) {
      values[to] = range.values[from];
      return;
    }
    for (let i = 0; i < shape[d]; i++) walk(d + 1, from + i * before[names[d]], to + i * after[names[d]]);
  };
  walk(0, 0, 0);
  range.axisNames = order;
  range.shape = newShape;
  range.values = values;
  return out;
}

describe('axisValues', () => {
  it('reads values as they are', () => {
    expect(axisValues({ values: [3, 1] })).toEqual([3, 1]);
  });

  it('works out start, stop and num, either way, and for one value', () => {
    expect(axisValues({ start: 0, stop: 2, num: 3 })).toEqual([0, 1, 2]);
    expect(axisValues({ start: 2, stop: 0, num: 3 })).toEqual([2, 1, 0]);
    expect(axisValues({ start: 5, stop: 5, num: 1 })).toEqual([5]);
  });

  it('says nothing for what it cannot read', () => {
    expect(axisValues(null)).toBeNull();
    expect(axisValues({ start: 0, stop: 1 })).toBeNull();
    expect(axisValues({ start: 0, stop: 1, num: 0 })).toBeNull();
  });
});

describe('mercY', () => {
  it('turns back into the latitude it came from', () => {
    for (const lat of [-80, -33.3, 0, 12.5, 60, 85]) expect(invMercY(mercY(lat))).toBeCloseTo(lat, 8);
  });

  it('stretches towards the poles, and stays finite at them', () => {
    expect(mercY(60) - mercY(50)).toBeGreaterThan(mercY(10) - mercY(0));
    expect(Number.isFinite(mercY(90))).toBe(true);
  });
});

describe('readCells: which responses it takes', () => {
  it('turns down what is not a coverage', () => {
    for (const json of [null, 'text', [], {}, { type: 'FeatureCollection' }]) {
      expect(refused(json)).toMatchObject({ why: 'other-view', reason: 'This response is not a coverage' });
    }
  });

  it('leaves a line through the data to the other views', () => {
    for (const domainType of ['Trajectory', 'VerticalProfile', 'Section', 'Corridor']) {
      expect(refused(grid({ domainType })).why).toBe('other-view');
    }
  });

  it('leaves one place with a time series to the chart', () => {
    expect(refused(grid({ domainType: 'PointSeries', x: [24], y: [60], t: DAY })).why).toBe('other-view');
    expect(refused(grid({ domainType: 'Point', x: [24], y: [60] })).reason).toBe('A Point is one place');
  });

  it('draws a Grid of one cell, which is a shape a server chose to send', () => {
    expect(drawn(grid({ x: [24], y: [60] })).cells).toBe(1);
  });

  it('leaves a Grid of one cell over time or height to the chart, as DMI’s position is', () => {
    expect(refused(grid({ x: [24], y: [60], t: DAY })).reason).toBe('One cell with steps of its own is one place');
    expect(refused(grid({ x: [24], y: [60], z: [1000, 500] })).why).toBe('other-view');
    expect(refused(dmiPosition).why).toBe('other-view');
  });

  it('leaves real responses for one place to the chart', () => {
    for (const json of [fmiPosition, fmiSeries, hidrografico]) expect(refused(json).why).toBe('other-view');
  });

  it('asks first above the limit, and draws when asked', () => {
    const huge = grid({ x: counting(MOST_VALUES_DRAWN + 1, 0), y: [60], values: new Array(MOST_VALUES_DRAWN + 1).fill(null) });
    const reading = refused(huge);
    expect(reading.why).toBe('too-large');
    expect(reading.reason).toBe(`${(MOST_VALUES_DRAWN + 1).toLocaleString('en-US')} values is more than this draws by itself`);
  });

  // 5 million values take about a second, and more on a busy machine or a CI runner
  const AT_THE_LIMIT = 30_000;

  it('draws the most it takes by itself without asking', () => {
    expect(readCells(grid({ x: counting(MOST_VALUES_DRAWN), y: [60], values: new Array(MOST_VALUES_DRAWN).fill(1) })).drawable).toBe(true);
  }, AT_THE_LIMIT);

  it('draws anyway, when asked to, what is above the limit', () => {
    expect(drawn(grid({ x: counting(MOST_VALUES_DRAWN + 1), y: [60], values: new Array(MOST_VALUES_DRAWN + 1).fill(1) }), { drawAnyway: true }).cells).toBe(MOST_VALUES_DRAWN + 1);
  }, AT_THE_LIMIT);
});

describe('readCells: faults are named with numbers, not drawn wrong', () => {
  const base = () => grid({ x: counting(7, 20), y: [65, 64, 63, 62, 61, 60, 59, 58, 57, 56, 55], t: ['2026-11-07T12:00:00Z'], z: [500] }) as Json;
  const cases: [string, (json: Json) => void, RegExp][] = [
    ['a shape against the axes', json => { json.ranges.temperature.shape = [1, 1, 7, 11]; }, /shape says y has 7 values, and the axis has 11/],
    ['too few values', json => { json.ranges.temperature.values.pop(); }, /makes 77 values, and values has 76/],
    ['names against shape', json => { json.ranges.temperature.axisNames = ['t', 'z', 'y']; }, /axisNames has 3 names, shape has 4/],
    ['a name with no axis', json => { json.ranges.temperature.axisNames = ['t', 'z', 'y', 'lon']; }, /"lon", which isn't an axis/],
    ['a range at a link', json => { json.ranges.temperature = 'https://example.org/range.json'; }, /at a link/],
    ['tiles', json => { json.ranges.temperature = { type: 'TiledNdArray', tileSets: [] }; }, /keeps its values in tiles/],
    ['no values', json => { delete json.ranges.temperature.values; }, /no values array/],
    ['a range that is no object', json => { json.ranges.temperature = 5; }, /range isn't an object/],
    ['an axis not of numbers', json => { json.domain.axes.x.values[3] = 'a'; }, /x axis has values that aren't numbers/],
    ['an axis not running one way', json => { json.domain.axes.x.values[3] = 99; }, /x axis doesn't run in one direction/],
    ['y not running one way', json => { json.domain.axes.y.values[3] = 99; }, /y axis doesn't run in one direction/],
    ['no y axis', json => { delete json.domain.axes.y; }, /no y axis to draw along: its axes are x, t, z/],
    ['a domain at a link', json => { json.domain = 'https://example.org/domain.json'; }, /domain is at a link/],
    ['no domain', json => { delete json.domain; }, /has no domain/],
    ['no ranges', json => { json.ranges = {}; }, /has no ranges/],
    ['x missing from the names', json => { json.ranges.temperature = { axisNames: ['t', 'z', 'y'], shape: [1, 1, 11], values: new Array(11).fill(1) }; }, /axisNames has no x, and x has 7 values/],
    ['y missing from the names', json => { json.ranges.temperature = { axisNames: ['t', 'z', 'x'], shape: [1, 1, 7], values: new Array(7).fill(1) }; }, /axisNames has no y, and y has 11 values/],
  ];
  for (const [what, edit, want] of cases) {
    it(what, () => {
      const json = base();
      edit(json);
      expect(refused(json).reason).toMatch(want);
    });
  }

  it('draws the parameters it can, and lists the one it cannot', () => {
    const json = base();
    json.ranges.broken = 'https://example.org/range.json';
    const cells = drawn(json);
    expect(cells.parameters.map(parameter => parameter.id)).toEqual(['temperature']);
    expect(cells.broken).toEqual([expect.objectContaining({ id: 'broken', problem: 'broken: its values are at a link, not in this response' })]);
    expect(cells.notes[0]).toEqual({ level: 'error', text: 'broken: its values are at a link, not in this response' });
  });
});

describe('readCells: a grid, read through its own axis order', () => {
  const json = () => grid({ x: counting(5, 20), y: [64, 63, 62, 61], t: DAY, z: [1000, 850] }) as Json;

  it('puts each value in its cell and step, and says where it came from', () => {
    const source = json();
    const cells = drawn(source);
    const [parameter] = cells.parameters;
    const values: number[] = source.ranges.temperature.values;
    for (let n = 0; n < 200; n++) {
      const t = n % 3;
      const z = (n * 7) % 2;
      const y = (n * 13) % 4;
      const x = (n * 17) % 5;
      const index = t * 2 * 4 * 5 + z * 4 * 5 + y * 5 + x;
      const slice = t * 2 + z;
      const cell = y * 5 + x;
      expect(parameter.data[slice * cells.cells + cell]).toBe(values[index]);
      expect(parameter.rawAt(cell, slice)).toEqual({ value: values[index], index, pointer: `/ranges/temperature/values/${index}`, coverage: null });
    }
  });

  it('gives the indices in the array’s own order', () => {
    const [parameter] = drawn(json()).parameters;
    expect(parameter.indicesAt(2 * 5 + 3, 1 * 2 + 1)).toEqual([['t', 1], ['z', 1], ['y', 2], ['x', 3]]);
  });

  for (const order of [['t', 'z', 'x', 'y'], ['z', 't', 'y', 'x'], ['x', 'y', 'z', 't'], ['y', 'x', 't', 'z'], ['x', 't', 'y', 'z']]) {
    it(`draws the same picture with the axes in the order ${order.join(', ')}`, () => {
      const base = drawn(json()).parameters[0].data;
      const source = permuted(json(), 'temperature', order);
      const cells = drawn(source);
      expect(cells.parameters[0].data).toEqual(base);
      for (let cell = 0; cell < cells.cells; cell += 3) {
        const raw = cells.parameters[0].rawAt(cell, 4);
        expect(source.ranges.temperature.values[raw.index!]).toBe(raw.value);
        expect(raw.value).toBe(cells.parameters[0].data[4 * cells.cells + cell]);
      }
      expect(cells.parameters[0].indicesAt(0, 0).map(([name]) => name)).toEqual(order);
    });
  }

  it('reads an axis of one value as fixed, not a step, whichever way the range is shaped', () => {
    const cells = drawn(grid({ t: ['2026-11-07T12:00:00Z'], z: [500] }));
    expect(cells.dims).toEqual([]);
    expect(cells.fixed).toEqual({ t: '2026-11-07T12:00:00Z', z: 500 });
    expect(cells.slices).toBe(1);
  });

  it('takes a range with no axis names as the domain’s axes that have more than one value', () => {
    const source = grid({ x: [1, 2], y: [6, 5], t: ['2026-11-07T12:00:00Z'], values: [1, 2, 3, 4] }) as Json;
    delete source.ranges.temperature.axisNames;
    delete source.ranges.temperature.shape;
    // x, y and t in the domain's order: x changes slowest
    expect(Array.from(drawn(source).parameters[0].data)).toEqual([1, 3, 2, 4]);
  });

  it('marks what is not a number as such, and keeps it as sent', () => {
    const cells = drawn(grid({ x: [1, 2], y: [6, 5], values: [1, null, 'n/a', 4] }));
    const [parameter] = cells.parameters;
    expect(Array.from(parameter.data).map(value => (value !== value ? 'gap' : value))).toEqual([1, 'gap', 'gap', 4]);
    expect(parameter.notNumbers).toBe(1);
    expect(parameter.rawAt(2, 0).value).toBe('n/a');
    expect(parameter.rawAt(1, 0).value).toBeNull();
  });

  it('writes an id’s slash as a path has to', () => {
    expect(drawn(grid({ id: 'a/b~c' })).parameters[0].rawAt(0, 0).pointer).toBe('/ranges/a~1b~0c/values/0');
  });

  it('keeps the exact value, which the picture’s 32 bits would round', () => {
    const cells = drawn(grid({ x: [1, 2], y: [6, 5], values: [291.2635272979736, 2, 3, 4] }));
    expect(cells.parameters[0].rawAt(0, 0).value).toBe(291.2635272979736);
    expect(cells.parameters[0].data[0]).not.toBe(291.2635272979736);
  });
});

describe('readCells: north up and west left, whatever the array’s order', () => {
  const base = () => grid({ x: [24, 25, 26], y: [61, 60], values: [1, 2, 3, 4, 5, 6] }) as Json;

  it('draws in the array’s order when it runs north first and west first', () => {
    const cells = drawn(base());
    expect(Array.from(cells.parameters[0].data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cells.order).toEqual({ firstX: 'left', firstY: 'top' });
    expect(asGrid(cells).ys).toEqual([61, 60]);
    expect(asGrid(cells).xs).toEqual([24, 25, 26]);
  });

  it('turns a south first array the right way up', () => {
    const cells = drawn(grid({ x: [24, 25, 26], y: [60, 61], values: [4, 5, 6, 1, 2, 3] }));
    expect(Array.from(cells.parameters[0].data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cells.order).toEqual({ firstX: 'left', firstY: 'bottom' });
    expect(asGrid(cells).ys).toEqual([61, 60]);
    // And the path still leads to the value
    expect(cells.parameters[0].rawAt(0, 0)).toMatchObject({ value: 1, index: 3 });
    expect(cells.parameters[0].indicesAt(0, 0)).toEqual([['y', 1], ['x', 0]]);
  });

  it('turns an east first array the right way round', () => {
    const cells = drawn(grid({ x: [26, 25, 24], y: [61, 60], values: [3, 2, 1, 6, 5, 4] }));
    expect(Array.from(cells.parameters[0].data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cells.order).toEqual({ firstX: 'right', firstY: 'top' });
    expect(asGrid(cells).xs).toEqual([24, 25, 26]);
    expect(cells.parameters[0].rawAt(0, 0)).toMatchObject({ value: 1, index: 2 });
  });

  it('reads start, stop and num as it reads values', () => {
    const cells = drawn(grid({ x: { start: 24, stop: 26, num: 3 }, y: { start: 61, stop: 60, num: 2 }, values: [1, 2, 3, 4, 5, 6] }));
    expect(Array.from(cells.parameters[0].data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cells.order).toEqual({ firstX: 'left', firstY: 'top' });
  });

  it('can tell a response with its y axis reversed from the original, since that’s what a flip is', () => {
    const flipped = clone(base());
    flipped.domain.axes.y.values.reverse();
    expect(drawn(flipped).parameters[0].data).not.toEqual(drawn(base()).parameters[0].data);
  });
});

describe('readCells: cell edges', () => {
  it('puts them half way between centres, and half a step beyond the ends', () => {
    const g = asGrid(drawn(grid({ x: [10, 11, 13], y: [61, 60], values: new Array(6).fill(1) })));
    expect(Array.from(g.xEdges)).toEqual([9.5, 10.5, 12, 14]);
    expect(g.assumedSize).toBe(false);
  });

  it('runs top to bottom in Web Mercator’s y for lon/lat', () => {
    const g = asGrid(drawn(grid({ x: [10, 11], y: [61, 60], values: [1, 2, 3, 4] })));
    expect(g.yEdges[0]).toBeCloseTo(mercY(61.5), 8);
    expect(g.yEdges[1]).toBeCloseTo(mercY(60.5), 8);
    expect(g.yEdges[2]).toBeCloseTo(mercY(59.5), 8);
  });

  it('stays in the response’s own y if it isn’t lon/lat', () => {
    const projected = [{ coordinates: ['x', 'y'], system: { type: 'ProjectedCRS', id: 'http://www.opengis.net/def/crs/EPSG/0/3035' } }];
    const cells = drawn(grid({ x: [4000000, 4001000], y: [3000000, 2999000], values: [1, 2, 3, 4], referencing: projected }));
    expect(cells.crs).toEqual({ declared: true, geographic: false, label: 'EPSG:3035', inDegrees: false });
    expect(Array.from(asGrid(cells).yEdges)).toEqual([3000500, 2999500, 2998500]);
  });

  it('takes a cell’s edges from bounds where it gives them, and then has nothing to note about its size', () => {
    const source = grid({ x: [10], y: [55], values: [1] }) as Json;
    source.domain.axes.x.bounds = [9, 11];
    source.domain.axes.y.bounds = [54.5, 56];
    const cells = drawn(source);
    const g = asGrid(cells);
    expect(Array.from(g.xEdges)).toEqual([9, 11]);
    expect(g.yEdges[0]).toBeCloseTo(mercY(56), 8);
    expect(g.assumedSize).toBe(false);
    expect(notesOf(cells).join()).not.toMatch(/only for show/);
  });

  it('ignores bounds that do not meet end to end, which a picture needs', () => {
    const source = grid({ x: [10, 12], y: [55], values: [1, 2] }) as Json;
    source.domain.axes.x.bounds = [9.5, 10.5, 11.5, 12.5];
    expect(Array.from(asGrid(drawn(source)).xEdges)).toEqual([9, 11, 13]);
  });

  it('gives a lone row the height of a column’s width, to have something to draw', () => {
    const g = asGrid(drawn(grid({ x: [1, 3], y: [60], values: [1, 2] })));
    expect(g.yEdges[0]).toBeCloseTo(mercY(61), 8);
    expect(g.yEdges[1]).toBeCloseTo(mercY(59), 8);
    const column = asGrid(drawn(grid({ x: [10], y: [61, 60], values: [1, 2] })));
    expect(Array.from(column.xEdges)).toEqual([9.5, 10.5]);
  });

  it('ignores bounds of the wrong length', () => {
    const source = grid({ x: [10, 12], y: [55], values: [1, 2] }) as Json;
    source.domain.axes.x.bounds = [9, 11, 13];
    expect(Array.from(asGrid(drawn(source)).xEdges)).toEqual([9, 11, 13]);
    source.domain.axes.x.bounds = [0, 1, 1, 2, 2, 3];
    expect(Array.from(asGrid(drawn(source)).xEdges)).toEqual([9, 11, 13]);
  });

  it('says a row’s height is only for show, without bounds', () => {
    const cells = drawn(grid({ x: [1, 2], y: [60], values: [1, 2] }));
    expect(asGrid(cells).assumedSize).toBe(true);
    expect(notesOf(cells)).toContain('One row, so the response doesn’t say how tall its cells are. The height drawn is only for show');
  });

  it('says the same of a column’s width and of one cell', () => {
    expect(notesOf(drawn(grid({ x: [1], y: [60, 59], values: [1, 2] })))).toContain('One column, so the response doesn’t say how wide its cells are. The width drawn is only for show');
    expect(notesOf(drawn(grid({ x: [1], y: [60], values: [1] })))).toContain('One cell, so the response doesn’t say how big it is. The size drawn is only for show');
  });
});

describe('readCells: referencing', () => {
  it('takes x and y with no CRS as lon/lat if they fit, and says so', () => {
    const cells = drawn(grid({ referencing: null }));
    expect(cells.crs.geographic).toBe(true);
    expect(cells.crs.declared).toBe(false);
    expect(notesOf(cells)).toContain("referencing says nothing about x and y. They're taken as lon/lat, since they fit");
  });

  it('takes them as plain numbers if they do not', () => {
    const cells = drawn(grid({ x: [4000000, 4001000], y: [3000000, 2999000], values: [1, 2, 3, 4], referencing: null }));
    expect(cells.crs.geographic).toBe(false);
    expect(notesOf(cells)).toContain("referencing says nothing about x and y. They're taken as plain numbers, since they don’t fit lon/lat");
  });

  it('says when lon/lat values are beyond what degrees can be', () => {
    expect(notesOf(drawn(grid({ x: [400, 401], y: [60, 59], values: [1, 2, 3, 4] })))).toContain('x or y is beyond what degrees can be, so they may be swapped or not in this CRS');
  });

  it('finds the CRS on the collection when the coverage has none', () => {
    expect(drawn(pointLattice([1, 2], [60, 61])).crs.declared).toBe(true);
  });

  it('reads a level’s unit from the CRS’s axes, or from its description', () => {
    const fromAxes = [...CRS84, { coordinates: ['z'], system: { cs: { csAxes: [{ unit: { symbol: 'hPa' } }] } } }];
    expect(drawn(grid({ z: [1000, 500], referencing: fromAxes })).zUnit).toBe('hPa');
    const inWords = [...CRS84, { coordinates: ['z'], system: { description: { en: 'Pressure in Pa' } } }];
    expect(drawn(grid({ z: [1000, 500], referencing: inWords })).zUnit).toBe('Pa');
    expect(drawn(grid({ z: [1000, 500] })).zUnit).toBe('');
  });
});

describe('readCells: points', () => {
  it('reads points that line up as a grid, south first though they were sent, each holding what its coverage says', () => {
    const cells = drawn(pointLattice([24, 25, 26], [60, 61]));
    expect(cells.source).toBe('points-grid');
    expect(cells.viewLabel).toBe('Grid');
    const g = asGrid(cells);
    expect([g.nx, g.ny, g.fromPoints]).toEqual([3, 2, true]);
    expect(g.ys).toEqual([61, 60]);
    const [parameter] = cells.parameters;
    g.ys.forEach((y, row) => g.xs.forEach((x, col) => {
      expect(parameter.data[row * g.nx + col]).toBe(100 * y + x);
    }));
    expect(notesOf(cells)).toContain('Sent as 6 Point coverages, which line up as a 3 × 2 grid. A Grid domain would say that in a fraction of the size');
  });

  it('gives a point’s real path in the collection', () => {
    const cells = drawn(pointLattice([24, 25], [60, 61]));
    // The top row is y 61, which was sent second: coverages 2 and 3
    expect(cells.parameters[0].rawAt(1, 0)).toEqual({ value: 6125, index: 0, pointer: '/coverages/3/ranges/temperature/values/0', coverage: 3 });
    expect(cells.parameters[0].indicesAt(1, 0)).toEqual([['coverage', 3]]);
    expect(cells.coverageCount).toBe(4);
  });

  it('counts the positions a lattice is missing, and shows them as absent, not as a value', () => {
    const coverages = [[24, 60], [25, 60], [26, 60], [24, 61], [25, 61]].map(([x, y]) => pointCoverage(x, y, { values: { temperature: [1] } }));
    const cells = drawn(pointCollection(coverages));
    expect(notesOf(cells)[0]).toBe('Sent as 5 Point coverages, which line up as a 3 × 2 grid, with 1 position missing. A Grid domain would say that in a fraction of the size');
    expect(cells.parameters[0].rawAt(2, 0)).toEqual({ value: undefined, index: null, pointer: null, coverage: null, absent: true });
    expect(cells.parameters[0].indicesAt(2, 0)).toEqual([]);
  });

  it('draws scattered points at their own places, and says why', () => {
    const coverages = counting(9).map(i => pointCoverage(20 + i * 0.13, 60 + ((i * 7) % 9) * 0.21, { values: { temperature: [i] } }));
    const cells = drawn(pointCollection(coverages));
    expect(cells.source).toBe('points');
    expect(cells.viewLabel).toBe('Points');
    const g = cells.geometry as SamplesGeometry;
    expect(g.kind).toBe('samples');
    expect(g.xs[3]).toBeCloseTo(20.39, 8);
    expect(cells.parameters[0].data[3]).toBe(3);
    expect(notesOf(cells)[0]).toMatch(/^Sent as 9 Point coverages, with 9 different x and 9 different y, so they aren't on lon\/lat lines\. Each is drawn at its own place/);
  });

  it('doesn’t call points a lattice if they’d fill too little of it', () => {
    // Six x and six y make 36 places, of which there are only 9
    const places = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [1, 2], [2, 3], [3, 4]];
    const cells = drawn(pointCollection(places.map(([x, y]) => pointCoverage(x, y, { values: { temperature: [1] } }))));
    expect(cells.source).toBe('points');
  });

  it('knows a point’s null from a point that isn’t there', () => {
    const cells = drawn(pointLattice([24, 25], [60, 61]));
    const json = pointLattice([24, 25], [60, 61]) as Json;
    json.coverages[3].ranges.temperature.values = [null];
    expect(cells.parameters[0].rawAt(1, 0).absent).toBeUndefined();
    expect(drawn(json).parameters[0].rawAt(1, 0)).toEqual({ value: null, index: 0, pointer: '/coverages/3/ranges/temperature/values/0', coverage: 3 });
  });

  it('works out how far apart points evenly spaced are, and doesn’t for scattered ones', () => {
    const even = counting(16).map(i => pointCoverage(24 + (i % 4) * 0.1 + Math.floor(i / 4) * 0.03, 60 + Math.floor(i / 4) * 0.05 - (i % 4) * 0.015, { values: { t: [i] } }));
    const spacing = (drawn(pointCollection(even)).geometry as SamplesGeometry).spacing;
    expect(spacing.regular).toBe(true);
    expect(spacing.km).toBeGreaterThan(4);
    expect(spacing.km).toBeLessThan(7);
    const scattered = [[0, 0], [0.01, 0.01], [3, 3], [3.5, 9], [10, 1], [11, 12], [15, 15], [15.1, 15], [20, 2]].map(([x, y]) => pointCoverage(20 + x, 50 + y, { values: { t: [1] } }));
    expect((drawn(pointCollection(scattered)).geometry as SamplesGeometry).spacing.regular).toBe(false);
  });

  it('puts the time series of each place in steps', () => {
    const t = ['2026-11-07T07:00:00Z', '2026-11-07T06:00:00Z'];
    const cells = drawn(pointLattice([24, 25], [60, 61]));
    expect(cells.dims).toEqual([]);
    const series = drawn(pointCollection([
      pointCoverage(24, 60, { t, values: { temperature: [7, 6] } }),
      pointCoverage(25, 61, { t, values: { temperature: [17, 16] } }),
    ]));
    // Sorted by time, whichever order they came in
    expect(series.dims).toEqual([{ name: 't', values: ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z'] }]);
    const place = (x: number) => (series.geometry as SamplesGeometry).xs.indexOf(x);
    expect(series.parameters[0].data[place(24)]).toBe(6);
    expect(series.parameters[0].data[series.cells + place(24)]).toBe(7);
    expect(series.parameters[0].rawAt(place(25), 1)).toMatchObject({ value: 17, index: 0, pointer: '/coverages/1/ranges/temperature/values/0' });
  });

  it('groups levels sent as separate coverages into steps, highest first', () => {
    const coverages = [850, 1000].flatMap(z => [[24, 60], [25, 60], [24, 61], [25, 61]].map(([x, y]) => pointCoverage(x, y, { z: [z], values: { temperature: [z + x] } })));
    const cells = drawn(pointCollection(coverages));
    expect(cells.dims).toEqual([{ name: 'z', values: [1000, 850] }]);
    expect(cells.slices).toBe(2);
    expect(cells.parameters[0].data[0]).toBe(1024);
    expect(cells.parameters[0].data[4]).toBe(874);
  });

  it('takes one time and one level as fixed', () => {
    const cells = drawn(pointCollection([pointCoverage(24, 60, { t: ['2026-11-07T06:00:00Z'], z: [500], values: { a: [1] } }), pointCoverage(25, 61, { t: ['2026-11-07T06:00:00Z'], z: [500], values: { a: [2] } })]));
    expect(cells.fixed).toEqual({ t: '2026-11-07T06:00:00Z', z: 500 });
  });

  it('merges a place sent twice, a number over a null, and says so', () => {
    const coverages = [
      pointCoverage(24, 60, { values: { gust: [5, 0].slice(0, 1), wind: [null] } }),
      pointCoverage(24, 60, { values: { gust: [null], wind: [3] } }),
      pointCoverage(25, 61, { values: { gust: [7], wind: [4] } }),
    ];
    const cells = drawn(pointCollection(coverages, {}));
    const [gust, wind] = cells.parameters;
    const at = (cells.geometry as SamplesGeometry).xs.indexOf(24);
    expect(gust.data[at]).toBe(5);
    expect(wind.data[at]).toBe(3);
    expect(gust.rawAt(at, 0).pointer).toBe('/coverages/0/ranges/gust/values/0');
    expect(wind.rawAt(at, 0).pointer).toBe('/coverages/1/ranges/wind/values/0');
    expect(notesOf(cells)).toContain('1 of the 3 coverages repeats a place and time another one has. A number is drawn over a null, and no two numbers disagree');
  });

  it('says when a place sent twice disagrees with itself, and draws the first', () => {
    const coverages = [pointCoverage(24, 60, { values: { a: [1] } }), pointCoverage(24, 60, { values: { a: [2] } }), pointCoverage(25, 61, { values: { a: [3] } })];
    const cells = drawn(pointCollection(coverages, {}));
    expect(cells.parameters[0].data[(cells.geometry as SamplesGeometry).xs.indexOf(24)]).toBe(1);
    expect(notesOf(cells)).toContain('1 of the 3 coverages repeats a place and time another one has. A number is drawn over a null, and 1 pair of numbers disagree, where the first is drawn');
  });

  it('turns down coverages with axes of their own', () => {
    const multi = pointCollection([grid({ x: [1, 2], y: [60, 61], values: [1, 2, 3, 4] }), pointCoverage(1, 2, { values: { a: [1] } })]);
    expect(refused(multi).reason).toBe('2 coverages with axes of their own: the Table has them, one by one');
  });

  it('turns down a place that is not numbers', () => {
    const bad = pointCollection([pointCoverage(24, 60, { values: { a: [1] } }), pointCoverage(24, 60, { values: { a: [1] } })]) as Json;
    bad.coverages[0].domain.axes.x.values = ['here'];
    expect(refused(bad).reason).toBe("A point's x or y isn't a number");
  });

  it('reads MultiPoint on a composite axis as points', () => {
    const cells = drawn({
      type: 'Coverage',
      domain: { type: 'Domain', domainType: 'MultiPoint', axes: { composite: { coordinates: ['x', 'y'], values: [[24, 60], [25, 61], [26, 63]] } }, referencing: CRS84 },
      ranges: { a: { type: 'NdArray', values: [1, 2, 3] } },
    });
    expect(cells.source).toBe('points');
    expect(cells.parameters[0].rawAt(2, 0).value).toBe(3);
  });

  it('turns down a composite axis of anything else', () => {
    const json = { type: 'Coverage', domain: { domainType: 'Odd', axes: { composite: { coordinates: ['x', 't'], values: [[1, 2]] } } }, ranges: {} };
    expect(refused(json).reason).toBe("A composite axis of x, t isn't cells on a plane");
  });
});

describe('readCells: polygons', () => {
  it('reads DWD’s real triangles over its real times', () => {
    const cells = drawn(dwdArea);
    expect(cells.source).toBe('polygons');
    expect(cells.cells).toBe(31);
    expect(cells.dims.map(dim => [dim.name, dim.values.length])).toEqual([['t', 3]]);
    expect(notesOf(cells)[0]).toBe('Sent as 31 polygons on a composite axis, triangles of the model’s own grid. Each is drawn as it is');
  });

  it('draws DWD’s triangles as sent, with their values and paths', () => {
    const cells = drawn(triangles([5, null]));
    expect(cells.source).toBe('polygons');
    expect(cells.viewLabel).toBe('Cells');
    const g = cells.geometry as PolygonsGeometry;
    expect(Array.from(g.offsets)).toEqual([0, 4, 8]);
    expect(g.bbox).toEqual([10, 50, 12, 51]);
    expect(Array.from(g.pts.slice(0, 4))).toEqual([10, 50, 11, 50]);
    expect(cells.parameters[0].data[0]).toBe(5);
    expect(cells.parameters[0].rawAt(1, 0)).toEqual({ value: null, index: 1, pointer: '/ranges/CAPE/values/1', coverage: null });
    expect(notesOf(cells)[0]).toBe('Sent as 2 polygons on a composite axis, triangles of the model’s own grid. Each is drawn as it is');
  });

  it('reads a t axis over them, in the array’s order', () => {
    const cells = drawn(triangles([1, 2, 3, 4], ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z']));
    expect(cells.dims.map(dim => dim.name)).toEqual(['t']);
    expect(cells.parameters[0].rawAt(1, 1)).toMatchObject({ value: 4, index: 3 });
    expect(cells.parameters[0].indicesAt(1, 1)).toEqual([['t', 1], ['composite', 1]]);
  });

  it('reads the composite axis first or last, by the range’s own order', () => {
    const json = triangles([1, 2, 3, 4], ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z']) as Json;
    json.coverages[0].ranges.CAPE.axisNames = ['composite', 't'];
    json.coverages[0].ranges.CAPE.shape = [2, 2];
    const [parameter] = drawn(json).parameters;
    expect(Array.from(parameter.data)).toEqual([1, 3, 2, 4]);
    expect(parameter.rawAt(1, 0)).toMatchObject({ value: 3, index: 2 });
  });

  it('leaves one polygon to the chart, as one place', () => {
    const one = triangles([1, 2]) as Json;
    one.coverages[0].domain.axes.composite.values = [one.coverages[0].domain.axes.composite.values[0]];
    expect(refused(one)).toEqual({ drawable: false, why: 'other-view', reason: 'A MultiPolygonSeries of one polygon is one place' });
  });
});

describe('readCells: notes', () => {
  const noted = (values: unknown[], unit = 'K', id = 'temperature') => notesOf(drawn(grid({ x: counting(values.length, 0).map(i => i * 0.001), y: [60], values, unit, id })));
  const field = counting(200).map(i => 290 + i * 0.01);

  it('names a fill value far from the rest, and counts it', () => {
    expect(noted([...field, -1e34, -1e34])).toContain('temperature has 2 values of -1e+34, which looks like a fill value, far from the rest (290 to 291.99)');
  });

  it('doesn’t call what’s only far off a fill value', () => {
    expect(noted([...field, 500])).toContain('temperature has 1 value of 500, far from the rest (290 to 291.99)');
  });

  it('says when one value is most of the range’s end, and may be a code', () => {
    const notes = noted([...new Array(100).fill(-32), ...counting(100).map(i => -31.5 + i * 0.5)], 'dBZ');
    expect(notes).toContain('-32 dBZ is in 100 of 200 temperature values (50%), at the bottom of the range. It may be a code and not a measurement');
  });

  it('says it once of a code that’s also far off', () => {
    const notes = noted([...new Array(970).fill(-64.003), ...counting(30)], 'dBZ');
    expect(notes).toContain('temperature has 970 values of -64.003, far from the rest (0 to 29)');
    expect(notes.join()).not.toMatch(/-64\.003 dBZ is in/);
  });

  it('has nothing to say of a code among a few values', () => {
    expect(noted([5, 5, 5, 5, 6, 7]).join()).not.toMatch(/is in \d+ of/);
    expect(noted([...new Array(30).fill(5), ...counting(20, 6)]).join()).toMatch(/5 K is in 30 of 50/);
  });

  it('doesn’t suspect a zero of being a code', () => {
    const notes = drawn(grid({ x: counting(200), y: [60], values: [...new Array(100).fill(0), ...counting(100, 1)], id: 'rain', unit: 'mm' })).notes;
    expect(notes).toContainEqual({ level: 'info', text: '0 mm is in 100 of 200 rain values (50%), at the bottom of the range', parameter: 'rain' });
  });

  it('says a parameter is all null, and doesn’t go on about it', () => {
    const cells = drawn(grid({ x: [1, 2], y: [60], values: [null, null] }));
    expect(cells.notes.filter(note => note.parameter)).toEqual([{ level: 'warn', text: 'All 2 values of temperature are null', parameter: 'temperature' }]);
  });

  it('says a parameter has no numbers when what it has is text', () => {
    expect(notesOf(drawn(grid({ x: [1, 2], y: [60], values: ['a', 'b'] })))).toContain("temperature has no numbers: 2 values aren't numbers");
  });

  it('says which steps are all null', () => {
    const cells = drawn(grid({ x: [1, 2], y: [60], t: DAY, values: [1, 2, null, null, 3, 4] }));
    expect(notesOf(cells)).toContain('1 step of temperature is all null');
  });

  const units: [string, string, number[], string | null][] = [
    ['temperature', '°C', [285, 292], 'temperature says °C, and its values (285 to 292) look like kelvin'],
    ['temperature', 'K', [2, 12], 'temperature says K, and its values (2 to 12) look like °C'],
    ['temperature', '°C', [2, 12], null],
    ['temperature', 'K', [285, 292], null],
    ['pressure', 'hPa', [101000, 102000], 'pressure says hPa, and its values (101000 to 102000) look like Pa'],
    ['pressure', 'Pa', [1010, 1020], 'pressure says Pa, and its values (1010 to 1020) look like hPa'],
    ['pressure', 'hPa', [1010, 1020], null],
    ['humidity', '%', [0.2, 0.9], 'humidity says %, and its values (0.2 to 0.9) look like a fraction'],
    ['humidity', '%', [20, 90], null],
    ['wind', '°C', [285, 292], null],
  ];
  for (const [id, unit, values, want] of units) {
    it(`${id} in ${unit} at ${values.join(' to ')}: ${want ?? 'nothing to say'}`, () => {
      const notes = notesOf(drawn(grid({ x: [1, 2], y: [60], values, id, unit })));
      const said = notes.filter(note => / says /.test(note));
      expect(said).toEqual(want ? [want] : []);
    });
  }
});

describe('axisDrift and its note', () => {
  it('finds steps that aren’t even', () => {
    expect(axisDrift([0, 1, 2.2, 3])?.spread).toBeCloseTo(0.4, 8);
    expect(axisDrift([0, 1])).toBeNull();
  });

  const drifted = (x: number[]) => notesOf(drawn(grid({ x, y: [61, 60], values: new Array(x.length * 2).fill(1) }))).some(note => /steps aren't even/.test(note));
  // As a Lambert grid's axis looks when it's labelled lon/lat
  const projected = counting(200).map(i => 25.98 + i * 0.0057 + i * i * 1.5e-7);

  it('fires on a projected grid labelled lon/lat', () => {
    expect(drifted(projected)).toBe(true);
    expect(notesOf(drawn(grid({ x: projected, y: [61, 60], values: new Array(400).fill(1) }))).find(note => /steps/.test(note))).toMatch(/^The x steps aren't even: 0\.00\d+° to 0\.00\d+°\. A lon\/lat grid has even steps, so this may be a projected grid labelled lon\/lat, where one axis can't place every row\. Check a cell with position$/);
  });

  it('stays quiet on floating point noise', () => {
    expect(drifted(counting(200).map(i => 20.03125 + i * 0.1 + (i % 2) * 1e-12))).toBe(false);
  });

  it('stays quiet on values rounded to a few decimals, whose steps differ but whose line is straight', () => {
    expect(drifted(counting(200).map(i => Number((20 + i * 0.0625).toFixed(3))))).toBe(false);
  });

  it('stays quiet when it isn’t lon/lat, where uneven axes are fine', () => {
    const notes = notesOf(drawn(grid({ x: projected.map(v => v * 100000), y: [6100000, 6000000], values: new Array(400).fill(1), referencing: null })));
    expect(notes.join()).not.toMatch(/steps aren't even/);
  });

  it('looks at y too', () => {
    const y = projected.map(v => v + 30).reverse();
    expect(notesOf(drawn(grid({ x: [1, 2], y, values: new Array(400).fill(1) }))).join()).toMatch(/The y steps aren't even/);
  });
});

describe('stepsOfSlice', () => {
  it('turns a slice back into its steps, the first axis slowest', () => {
    const dims = [{ name: 't', values: [0, 1, 2] }, { name: 'z', values: [0, 1] }];
    expect(stepsOfSlice(dims, 0)).toEqual({ t: 0, z: 0 });
    expect(stepsOfSlice(dims, 1)).toEqual({ t: 0, z: 1 });
    expect(stepsOfSlice(dims, 5)).toEqual({ t: 2, z: 1 });
  });
});
