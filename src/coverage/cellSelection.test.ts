import { describe, expect, it } from 'vitest';
import {
  cellRows, codesFor, colourRange, figuresInScope, longestReadout, longestStepCaption, notesFor, opensAsPicture, positionUrl, scopeOf,
  sliceIndex, sortedCells, sourceCell, stepCaption, stepKinds, stepLabel, stepOf, tallies,
} from './cellSelection';
import { analyse } from './cellFigures';
import { ABOVE_CODE, BELOW_CODE, NULL_CODE } from './colourScale';
import { readCells, type DrawableCells, type GridGeometry } from './coverageCells';
import { CRS84, counting, grid, pointCollection, pointCoverage, pointLattice, triangles } from './cellsTestData';

const drawn = (json: unknown) => readCells(json) as DrawableCells;
const DAY = ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z', '2026-11-07T08:00:00Z'];
const AREA = 'https://example.org/edr/collections/c/area?coords=POLYGON((1%202))&datetime=2026-11-07T06:00:00Z&f=CoverageJSON';

describe('steps', () => {
  const dims = [{ name: 't', values: [0, 1, 2] }, { name: 'z', values: [0, 1] }];

  it('turns steps into a slice, the first axis slowest', () => {
    expect(sliceIndex(dims, {})).toBe(0);
    expect(sliceIndex(dims, { z: 1 })).toBe(1);
    expect(sliceIndex(dims, { t: 2, z: 1 })).toBe(5);
    expect(sliceIndex([], {})).toBe(0);
  });

  it('keeps a step from another response within this one’s axis', () => {
    expect(stepOf(dims[0], { t: 9 })).toBe(2);
    expect(stepOf(dims[0], { t: -1 })).toBe(0);
    expect(sliceIndex(dims, { t: 9, z: 9 })).toBe(5);
  });

  it('writes a time as a moment, and a level with its unit', () => {
    const cells = drawn(grid({ t: DAY, z: [1000, 500], referencing: [...CRS84, { coordinates: ['z'], system: { description: { en: 'Pressure in hPa' } } }] }));
    expect(stepLabel(cells, cells.dims[0], 1)).toBe('Nov 7 07:00');
    expect(stepLabel(cells, cells.dims[1], 1)).toBe('500 hPa');
    expect(stepCaption(cells, cells.dims[0], 1)).toBe('Nov 7 07:00 (2/3)');
  });

  it('writes what isn’t a time as it was sent', () => {
    const cells = drawn(grid({ t: ['later', 'much later'] }));
    expect(stepLabel(cells, cells.dims[0], 0)).toBe('later');
  });

  it('knows the longest caption, which the bar keeps room for', () => {
    const cells = drawn(grid({ z: [1000, 925, 50], referencing: [...CRS84, { coordinates: ['z'], system: { cs: { csAxes: [{ unit: { symbol: 'hPa' } }] } } }] }));
    expect(longestStepCaption(cells, cells.dims[0])).toBe('1000 hPa (1/3)'.length);
    const later = drawn(grid({ z: [50, 925, 1000], referencing: [...CRS84, { coordinates: ['z'], system: { cs: { csAxes: [{ unit: { symbol: 'hPa' } }] } } }] }));
    expect(longestStepCaption(later, later.dims[0])).toBe('1000 hPa (3/3)'.length);
  });

  it('marks a step with nulls, and more strongly when it’s all null, over the other axes', () => {
    const cells = drawn(grid({ x: [1, 2], y: [60], t: DAY, z: [1000, 500], values: [1, 2, 3, null, null, null, null, null, 5, 6, 7, 8] }));
    const [parameter] = cells.parameters;
    expect(stepKinds(cells, parameter, cells.dims[0])).toEqual(['some', 'none', '']);
    expect(stepKinds(cells, parameter, cells.dims[1])).toEqual(['some', 'some']);
  });
});

describe('what the colours cover', () => {
  it('shares a scale across times, so that a colour means the same in each', () => {
    expect(scopeOf(drawn(grid({ t: DAY })), null)).toBe('all');
  });

  it('gives each level its own by default, where one scale would leave each flat', () => {
    expect(scopeOf(drawn(grid({ t: DAY, z: [1000, 500] })), null)).toBe('this');
  });

  it('does as it’s told, unless there’s only the one step', () => {
    expect(scopeOf(drawn(grid({ t: DAY })), 'this')).toBe('this');
    expect(scopeOf(drawn(grid({ t: DAY, z: [1000, 500] })), 'all')).toBe('all');
    expect(scopeOf(drawn(grid()), 'this')).toBe('all');
  });

  const levels = () => drawn(grid({ x: [1, 2], y: [60], t: ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z'], z: [1000, 500], values: [280, 281, 250, 251, 282, 283, 252, 253] }));

  it('takes this level over all times', () => {
    const cells = levels();
    const figures = figuresInScope(cells.parameters[0], cells, 'this', { t: 1, z: 1 });
    expect(figures.min).toBe(250);
    expect(figures.max).toBe(253);
    expect(figures.total).toBe(4);
  });

  it('takes this time alone where there are no levels', () => {
    const cells = drawn(grid({ x: [1, 2], y: [60], t: DAY, values: [1, 2, 3, 4, 5, 6] }));
    const figures = figuresInScope(cells.parameters[0], cells, 'this', { t: 1 });
    expect([figures.min, figures.max]).toEqual([3, 4]);
  });

  it('takes the whole parameter for all, and works each scope out once', () => {
    const cells = levels();
    const [parameter] = cells.parameters;
    expect(figuresInScope(parameter, cells, 'all', {})).toBe(parameter.figures);
    expect(figuresInScope(parameter, cells, 'this', { z: 1 })).toBe(figuresInScope(parameter, cells, 'this', { z: 1, t: 1 }));
    expect(figuresInScope(parameter, cells, 'this', { z: 0 })).not.toBe(figuresInScope(parameter, cells, 'this', { z: 1 }));
  });
});

describe('colourRange', () => {
  const figures = analyse(Float32Array.from([...counting(1000).map(i => 280 + i * 0.01), -1e34]), 1, 1001);

  it('leaves out what’s set apart by itself', () => {
    expect(colourRange(figures, 'auto', null, null, 'sequential')).toEqual([280, figures.hi]);
  });

  it('takes everything for All values', () => {
    expect(colourRange(figures, 'all', null, null, 'sequential')).toEqual([figures.min, figures.max]);
  });

  it('takes the numbers set, as long as they make a range', () => {
    expect(colourRange(figures, 'set', 285, 286, 'sequential')).toEqual([285, 286]);
    expect(colourRange(figures, 'set', 286, 285, 'sequential')).toEqual([280, figures.hi]);
    expect(colourRange(figures, 'set', null, 285, 'sequential')).toEqual([280, figures.hi]);
  });

  it('centres on 0 around 0', () => {
    const wind = analyse(Float32Array.from([-2, 0, 5]), 1, 3);
    expect(colourRange(wind, 'auto', null, null, 'diverging')).toEqual([-5, 5]);
    const other = analyse(Float32Array.from([-5, 0, 2]), 1, 3);
    expect(colourRange(other, 'auto', null, null, 'diverging')).toEqual([-5, 5]);
  });

  it('has no range for all null', () => {
    expect(colourRange(analyse(Float32Array.from([NaN]), 1, 1), 'auto', null, null, 'diverging')).toEqual([null, null]);
  });
});

describe('flipping', () => {
  const cells = () => drawn(grid({ x: [1, 2, 3], y: [61, 60], values: [1, 2, 3, 4, 5, 6] }));

  it('leaves the cell alone as sent', () => {
    expect(sourceCell(cells().geometry, 4, 'none')).toBe(4);
  });

  it('takes the cell from the other row or column', () => {
    expect(sourceCell(cells().geometry, 0, 'ns')).toBe(3);
    expect(sourceCell(cells().geometry, 4, 'ns')).toBe(1);
    expect(sourceCell(cells().geometry, 0, 'ew')).toBe(2);
    expect(sourceCell(cells().geometry, 4, 'ew')).toBe(4);
  });

  it('only flips a grid', () => {
    const points = drawn(pointCollection(counting(9).map(i => pointCoverage(i * 1.3, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    expect(sourceCell(points.geometry, 3, 'ns')).toBe(3);
  });

  it('draws the flipped codes', () => {
    const c = cells();
    expect(Array.from(codesFor(c.parameters[0], c, 0, 1, 6, 'ns'))).toEqual(Array.from(codesFor(c.parameters[0], c, 0, 1, 6, 'none')).map((_, i, all) => all[sourceCell(c.geometry, i, 'ns')]));
    expect(codesFor(c.parameters[0], c, 0, 1, 6, 'ew')[0]).toBe(codesFor(c.parameters[0], c, 0, 1, 6, 'none')[2]);
  });

  it('flipping twice is where it started', () => {
    const { geometry } = cells();
    for (let cell = 0; cell < 6; cell++) expect(sourceCell(geometry, sourceCell(geometry, cell, 'ns'), 'ns')).toBe(cell);
  });
});

describe('codesFor', () => {
  it('reads the step it’s given', () => {
    const cells = drawn(grid({ x: [1, 2], y: [60], t: ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z'], values: [0, 10, 10, 0] }));
    expect(Array.from(codesFor(cells.parameters[0], cells, 0, 0, 10, 'none'))).toEqual([0, 255]);
    expect(Array.from(codesFor(cells.parameters[0], cells, 1, 0, 10, 'none'))).toEqual([255, 0]);
  });

  it('has something to draw with no range', () => {
    const cells = drawn(grid({ x: [1, 2], y: [60], values: [null, null] }));
    expect(Array.from(codesFor(cells.parameters[0], cells, 0, null, null, 'none'))).toEqual([NULL_CODE, NULL_CODE]);
  });
});

describe('tallies', () => {
  it('counts a bar per 1/64th of the range, and each kind apart', () => {
    const counted = tallies(Uint16Array.from([0, 3, 4, 255, NULL_CODE, NULL_CODE, BELOW_CODE, ABOVE_CODE, ABOVE_CODE, ABOVE_CODE]));
    expect(counted.bins[0]).toBe(2);
    expect(counted.bins[1]).toBe(1);
    expect(counted.bins[63]).toBe(1);
    expect(counted.bins).toHaveLength(64);
    expect([counted.nulls, counted.below, counted.above]).toEqual([2, 1, 3]);
  });
});

describe('notesFor', () => {
  const twoParameters = (values: unknown[]) => {
    const json = grid({ x: [1, 2], y: [60], values: [1, 2], id: 'a' }) as { ranges: Record<string, unknown>; parameters: Record<string, unknown> };
    json.ranges.b = { type: 'NdArray', axisNames: ['y', 'x'], shape: [1, 2], values };
    json.parameters.b = { type: 'Parameter' };
    return drawn(json);
  };
  const texts = (cells: DrawableCells, id: string, url = '') => notesFor(cells, cells.parameters.find(parameter => parameter.id === id)!, url).map(note => note.text);

  it('has this parameter’s notes and the response’s, and not another parameter’s', () => {
    const cells = twoParameters([null, null]);
    expect(texts(cells, 'b')).toContain('All 2 values of b are null');
    expect(texts(cells, 'a')).not.toContain('All 2 values of b are null');
  });

  it('says from any parameter when others are all null', () => {
    expect(texts(twoParameters([null, null]), 'a')).toContain('1 other parameter is all null: b');
  });

  it('names a few of many all null parameters', () => {
    const json = grid({ x: [1, 2], y: [60], values: [1, 2], id: 'ok' }) as { ranges: Record<string, unknown> };
    for (const id of ['p', 'q', 'r', 's', 't']) json.ranges[id] = { type: 'NdArray', axisNames: ['y', 'x'], shape: [1, 2], values: [null, null] };
    expect(texts(drawn(json), 'ok')).toContain('5 other parameters are all null: p, q, r and 2 more');
  });

  it('says a parameter has no unit', () => {
    const cells = twoParameters([3, 4]);
    expect(texts(cells, 'b')).toContain('b has no unit');
    expect(texts(cells, 'a').join()).not.toMatch(/no unit/);
  });

  it('says it once when none of them has one', () => {
    const json = grid({ x: [1, 2], y: [60], values: [1, 2], unit: '' }) as { ranges: Record<string, unknown> };
    json.ranges.b = { type: 'NdArray', axisNames: ['y', 'x'], shape: [1, 2], values: [3, 4] };
    expect(texts(drawn(json), 'temperature')).toContain('None of the 2 parameters has a unit');
  });

  it('says when a datetime was asked for and the response has no time', () => {
    const cells = drawn(grid());
    const says = "You asked for a datetime, and the response has no t axis, so it doesn't say which time this is";
    expect(texts(cells, 'temperature', 'https://x/area?datetime=2026-11-07T00:00:00Z')).toContain(says);
    expect(texts(cells, 'temperature', 'https://x/area?coords=1')).not.toContain(says);
    expect(texts(drawn(grid({ t: DAY })), 'temperature', 'https://x/area?datetime=a')).not.toContain(says);
    expect(texts(drawn(grid({ t: ['2026-11-07T00:00:00Z'] })), 'temperature', 'https://x/area?datetime=a')).not.toContain(says);
  });
});

describe('opensAsPicture', () => {
  const scattered = (n: number) => pointCollection(counting(n).map(i => pointCoverage(i * 1.3, 50 + (i * 7) % 9, { values: { a: [i] } })));

  it('opens a grid and polygons as a picture', () => {
    expect(opensAsPicture(drawn(grid()))).toBe(true);
    expect(opensAsPicture(drawn(triangles([1, 2])))).toBe(true);
    expect(opensAsPicture(drawn(pointLattice([1, 2], [60, 61])))).toBe(true);
  });

  it('opens from 9 scattered places, and leaves fewer to the chart', () => {
    expect(opensAsPicture(drawn(scattered(9)))).toBe(true);
    expect(opensAsPicture(drawn(scattered(8)))).toBe(false);
  });
});

describe('positionUrl', () => {
  const cellOf = (cells: DrawableCells, row: number, col: number) => row * (cells.geometry as GridGeometry).nx + col;

  it('asks /position for the cell’s centre, at the datetime asked for, for this parameter, in the same format', () => {
    const cells = drawn(grid());
    expect(positionUrl(AREA, cells, cells.parameters[0], cellOf(cells, 1, 2), {})).toBe(
      'https://example.org/edr/collections/c/position?coords=POINT(26%2060)&datetime=2026-11-07T06%3A00%3A00Z&parameter-name=temperature&f=CoverageJSON',
    );
  });

  it('asks for this step’s time and level', () => {
    const cells = drawn(grid({ t: DAY, z: [1000, 500] }));
    const url = positionUrl('https://x/edr/collections/c/cube?bbox=1,2,3,4', cells, cells.parameters[0], 0, { t: 2, z: 1 });
    expect(url).toBe('https://x/edr/collections/c/position?coords=POINT(24%2061)&datetime=2026-11-07T08%3A00%3A00Z&z=500&parameter-name=temperature');
  });

  it('asks for the one time and level the response says, over what was asked', () => {
    const cells = drawn(grid({ t: ['2026-11-07T12:00:00Z'], z: [850] }));
    const url = positionUrl(AREA, cells, cells.parameters[0], 0, {})!;
    expect(new URL(url).searchParams.get('datetime')).toBe('2026-11-07T12:00:00Z');
    expect(new URL(url).searchParams.get('z')).toBe('850');
  });

  it('adds nothing that wasn’t chosen, and keeps the CRS', () => {
    const cells = drawn(grid());
    expect(positionUrl('https://x/edr/collections/c/area?coords=a', cells, cells.parameters[0], 0, {})).toBe('https://x/edr/collections/c/position?coords=POINT(24%2061)&parameter-name=temperature');
    expect(positionUrl('https://x/edr/collections/c/area?coords=a&crs=EPSG:4326&limit=9', cells, cells.parameters[0], 0, {})).toBe('https://x/edr/collections/c/position?coords=POINT(24%2061)&parameter-name=temperature&crs=EPSG%3A4326');
  });

  it('has no check for what wasn’t an area, or for polygons, which have no one place', () => {
    const cells = drawn(grid());
    expect(positionUrl('https://x/edr/collections/c/position?coords=a', cells, cells.parameters[0], 0, {})).toBeNull();
    expect(positionUrl('https://x/edr/collections/c/items', cells, cells.parameters[0], 0, {})).toBeNull();
    const polygons = drawn(triangles([1, 2]));
    expect(positionUrl(AREA, polygons, polygons.parameters[0], 0, {})).toBeNull();
  });

  it('asks for a point where the point is', () => {
    const cells = drawn(pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    expect(positionUrl(AREA, cells, cells.parameters[0], 2, {})).toContain(`POINT(22%20${50 + 14 % 9})`);
  });

  it('reads the path even with an encoded parameter id', () => {
    const cells = drawn(grid({ id: 'a b/c' }));
    expect(new URL(positionUrl(AREA, cells, cells.parameters[0], 0, {})!).searchParams.get('parameter-name')).toBe('a b/c');
  });
});

describe('the table', () => {
  const cells = () => drawn(grid({ x: [24, 25], y: [61, 60], values: [3, null, -1e34, 7] }));

  it('sorts by value, up or down, with nulls last either way', () => {
    const c = cells();
    expect(Array.from(sortedCells(c.parameters[0], c, 0, 1))).toEqual([2, 0, 3, 1]);
    expect(Array.from(sortedCells(c.parameters[0], c, 0, -1))).toEqual([3, 0, 2, 1]);
  });

  it('sorts the step it’s at', () => {
    const c = drawn(grid({ x: [1, 2], y: [60], t: ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z'], values: [1, 2, 9, 8] }));
    expect(Array.from(sortedCells(c.parameters[0], c, 1, 1))).toEqual([1, 0]);
  });

  it('builds a page of rows with exact values, indices as the array has them, and where they are', () => {
    const c = drawn(grid({ x: [24, 25], y: [60, 61], values: [3.123456789012, 2, 8, null] }));
    expect(cellRows(c, 0, 100, null, 0, 'none')).toEqual([
      { id: 0, yi: 1, xi: 0, y: 61, x: 24, p0: 8 },
      { id: 1, yi: 1, xi: 1, y: 61, x: 25, p0: null },
      { id: 2, yi: 0, xi: 0, y: 60, x: 24, p0: 3.123456789012 },
      { id: 3, yi: 0, xi: 1, y: 60, x: 25, p0: 2 },
    ]);
  });

  it('builds only the page', () => {
    expect(cellRows(cells(), 1, 3, null, 0, 'none').map(row => row.id)).toEqual([1, 2]);
    expect(cellRows(cells(), 2, 100, null, 0, 'none').map(row => row.id)).toEqual([2, 3]);
  });

  it('follows the order it’s given', () => {
    const c = cells();
    expect(cellRows(c, 0, 2, sortedCells(c.parameters[0], c, 0, 1), 0, 'none').map(row => row.p0)).toEqual([-1e34, 3]);
  });

  it('shows what’s drawn when flipped: the place drawn, with the value and indices it came from', () => {
    const [row] = cellRows(cells(), 0, 1, null, 0, 'ns');
    expect(row).toEqual({ id: 0, yi: 1, xi: 0, y: 61, x: 24, p0: -1e34 });
  });

  it('has a column per parameter', () => {
    const json = grid({ x: [1, 2], y: [60], values: [1, 2], id: 'a' }) as { ranges: Record<string, unknown> };
    json.ranges.b = { type: 'NdArray', axisNames: ['y', 'x'], shape: [1, 2], values: [3, 4] };
    expect(cellRows(drawn(json), 1, 2, null, 0, 'none')[0]).toMatchObject({ p0: 2, p1: 4 });
  });

  it('has the coverage of a point, and its place', () => {
    const c = drawn(pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    expect(cellRows(c, 2, 3, null, 0, 'none')[0]).toEqual({ id: 2, coverage: 2, x: 22, y: 55, p0: 2 });
  });

  it('has the polygon’s place on its axis', () => {
    expect(cellRows(drawn(triangles([5, 6])), 1, 2, null, 0, 'none')[0]).toEqual({ id: 1, composite: 1, p0: 6 });
  });
});

describe('longestReadout', () => {
  // What the readout writes for a cell: it must never be longer than what's kept room for, or it would jump
  const check = (cells: DrawableCells, written: (cell: number, slice: number) => { where: string; pointer: string | null }) => {
    for (const parameter of cells.parameters) {
      const longest = longestReadout(cells, parameter);
      for (let slice = 0; slice < cells.slices; slice++) {
        for (let cell = 0; cell < cells.cells; cell++) {
          const { where } = written(cell, slice);
          const raw = parameter.rawAt(cell, slice);
          const indices = parameter.indicesAt(cell, slice).map(([name, index]) => `${name} ${index}`).join(', ');
          expect(`${indices ? `[${indices}] ` : ''}${where}`.length).toBeLessThanOrEqual(longest.where.length);
          if (raw.pointer) expect(raw.pointer.length).toBeLessThanOrEqual(longest.pointer.length);
          if (typeof raw.value === 'number') expect(`${raw.value}${parameter.unit ? ` ${parameter.unit}` : ''}`.length).toBeLessThanOrEqual(longest.value.length);
        }
      }
    }
  };

  it('keeps room for every cell of a grid, with steps, of uneven digits', () => {
    const cells = drawn(grid({ x: [9.012345678901234, 24, 24.125], y: [60.5, 60, -5.25], t: DAY, z: [1000, 925], values: counting(54).map(i => (i % 2 ? -1e34 * i : 0.1 * i)) }));
    const g = cells.geometry as GridGeometry;
    check(cells, cell => ({ where: `x ${g.xs[cell % g.nx]}, y ${g.ys[Math.floor(cell / g.nx)]}`, pointer: null }));
  });

  it('keeps room for a cell’s many digits in its position in the array', () => {
    const cells = drawn(grid({ x: counting(150), y: counting(20).map(i => 60 - i), values: new Array(3000).fill(1) }));
    expect(longestReadout(cells, cells.parameters[0]).where).toContain('y 19, x 149');
    expect(longestReadout(cells, cells.parameters[0]).pointer).toBe('/ranges/temperature/values/2999');
  });

  it('keeps room for every point, as coverages', () => {
    const cells = drawn(pointCollection(counting(120).map(i => pointCoverage(20 + i * 0.0137, 50 + (i * 7) % 11 * 0.21, { values: { a: [i] } }))));
    const g = cells.geometry;
    if (g.kind !== 'samples') throw new Error('Points expected');
    check(cells, cell => ({ where: `x ${g.xs[cell]}, y ${g.ys[cell]}`, pointer: null }));
    expect(longestReadout(cells, cells.parameters[0]).where).toContain('[coverage 119]');
    expect(longestReadout(cells, cells.parameters[0]).pointer).toBe('/coverages/119/ranges/a/values/0');
  });

  it('keeps room for a polygon', () => {
    const cells = drawn(triangles([1, 2]));
    check(cells, () => ({ where: 'about x 10.50000, y 50.25000', pointer: null }));
  });

  it('counts a parameter’s unit', () => {
    const cells = drawn(grid({ unit: 'joule / kilogram' }));
    expect(longestReadout(cells, cells.parameters[0]).value.endsWith(' joule / kilogram')).toBe(true);
  });

  it('writes an id with a slash as the path does', () => {
    const cells = drawn(grid({ id: 'a/b' }));
    expect(longestReadout(cells, cells.parameters[0]).pointer).toContain('/ranges/a~1b/values/');
  });
});
