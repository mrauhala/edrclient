import { describe, expect, it } from 'vitest';
import { BELOW_CODE, NULL_CODE, hatchColours, lutFor } from './colourScale';
import { readCells, type DrawableCells, type GridGeometry } from './coverageCells';
import { axisToPixels, cellAtPixel, clampView, fullView, gridMaps, hitTest, paintGrid, pixelOf, plotLayout, scaleText, ticks, type PaintedPlot } from './paintCells';
import { grid, pointCollection, pointCoverage, triangles, counting } from './cellsTestData';

const drawn = (json: unknown) => readCells(json) as DrawableCells;

interface FakeImage { data: Uint8ClampedArray; width: number; height: number }
// As much of a canvas as painting a grid uses
function fakeContext() {
  const context = {
    image: null as FakeImage | null,
    at: [0, 0],
    createImageData: (width: number, height: number): FakeImage => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
    putImageData(image: FakeImage, x: number, y: number) {
      context.image = image;
      context.at = [x, y];
    },
    pixel(x: number, y: number) {
      return new Uint32Array(context.image!.data.buffer)[y * context.image!.width + x];
    },
  };
  return context as typeof context & CanvasRenderingContext2D;
}

describe('axisToPixels', () => {
  const evenEdges = (n: number, pixels: number) => Float64Array.from({ length: n + 1 }, (_, i) => (i / n) * pixels);
  const timesCovered = (edges: Float64Array, n: number, pixels: number) => {
    const { start, end } = axisToPixels(edges, n, pixels);
    const seen = new Uint16Array(n);
    for (let p = 0; p < pixels; p++) if (start[p] >= 0) for (let c = start[p]; c < end[p]; c++) seen[c]++;
    return seen;
  };

  for (const [n, pixels] of [[1000, 137], [2000, 333], [449, 296], [453, 450], [10000, 100]]) {
    it(`puts each of ${n} cells in exactly one of ${pixels} pixels, so that none is skipped`, () => {
      expect(timesCovered(evenEdges(n, pixels), n, pixels).every(times => times === 1)).toBe(true);
    });
  }

  for (const [n, pixels] of [[176, 520], [7, 500], [1, 150]]) {
    it(`gives each of ${pixels} pixels one of ${n} cells`, () => {
      expect(axisToPixels(evenEdges(n, pixels), n, pixels).start.every(cell => cell >= 0)).toBe(true);
    });
  }

  it('does the same for an uneven axis', () => {
    const n = 400;
    const raw = Array.from({ length: n + 1 }, (_, i) => i + i * i * 0.01);
    const pixels = 120;
    const edges = Float64Array.from(raw, edge => (edge / raw[n]) * pixels);
    expect(timesCovered(edges, n, pixels).every(times => times === 1)).toBe(true);
  });

  it('leaves pixels beyond the cells empty, on either side', () => {
    const { start, end } = axisToPixels(Float64Array.from([2, 4, 6]), 2, 8);
    expect(Array.from(start)).toEqual([-1, -1, 0, 0, 1, 1, -1, -1]);
    expect(Array.from(end)).toEqual([-1, -1, 1, 1, 2, 2, -1, -1]);
  });

  it('skips cells off to the left when zoomed in', () => {
    const { start } = axisToPixels(Float64Array.from([-20, -10, 0, 10]), 3, 10);
    expect(start[0]).toBe(2);
    expect(start[9]).toBe(2);
  });
});

describe('painting a grid', () => {
  const lut = lutFor('sequential', 'dark', null);
  const geometry = (nx: number, ny: number): GridGeometry => ({
    kind: 'grid', nx, ny, cells: nx * ny, xs: counting(nx), ys: counting(ny), assumedSize: false,
    xEdges: Float64Array.from({ length: nx + 1 }, (_, i) => i),
    yEdges: Float64Array.from({ length: ny + 1 }, (_, i) => ny - i),
  });
  const view = (g: GridGeometry) => ({ x0: 0, x1: g.nx, y0: g.ny, y1: 0 });

  it('colours each cell by its code', () => {
    const g = geometry(2, 2);
    const ctx = fakeContext();
    paintGrid(ctx, 5, 7, 2, 2, g, Uint16Array.from([0, 255, 128, 0]), lut, gridMaps(g, view(g), 2, 2), { scale: 1, mode: 'dark', highlight: null });
    expect(ctx.at).toEqual([5, 7]);
    expect(ctx.pixel(0, 0)).toBe(lut[0]);
    expect(ctx.pixel(1, 0)).toBe(lut[255]);
    expect(ctx.pixel(0, 1)).toBe(lut[128]);
  });

  it('hatches a null in the pane, and leaves a hole on the map', () => {
    const g = geometry(1, 1);
    const pane = fakeContext();
    paintGrid(pane, 0, 0, 10, 10, g, Uint16Array.from([NULL_CODE]), lut, gridMaps(g, view(g), 10, 10), { scale: 1, mode: 'dark', highlight: null });
    const [a, b] = hatchColours('dark');
    expect(new Set(new Uint32Array(pane.image!.data.buffer))).toEqual(new Set([a, b]));
    const map = fakeContext();
    paintGrid(map, 0, 0, 10, 10, g, Uint16Array.from([NULL_CODE]), lut, gridMaps(g, view(g), 10, 10), { scale: 1, mode: 'dark', highlight: null, nullClear: true });
    expect(new Set(new Uint32Array(map.image!.data.buffer))).toEqual(new Set([0]));
  });

  it('fades a null while something else is lit', () => {
    const g = geometry(1, 1);
    const ctx = fakeContext();
    paintGrid(ctx, 0, 0, 2, 2, g, Uint16Array.from([NULL_CODE]), lut, gridMaps(g, view(g), 2, 2), { scale: 1, mode: 'dark', highlight: { kind: 'above' } });
    expect(hatchColours('dark')).not.toContain(ctx.pixel(0, 0));
  });

  it('shows one outlier and one null among a million cells in a 100 × 100 picture', () => {
    const n = 1000;
    const g = geometry(n, n);
    const codes = new Uint16Array(n * n).fill(120);
    const outlier = 777 * n + 345;
    codes[outlier] = 250;
    codes[123 * n + 45] = NULL_CODE;
    const ctx = fakeContext();
    paintGrid(ctx, 0, 0, 100, 100, g, codes, lut, gridMaps(g, view(g), 100, 100), { scale: 1, mode: 'dark', highlight: null });
    const seen = new Set(new Uint32Array(ctx.image!.data.buffer));
    expect(seen.has(lut[250])).toBe(true);
    expect(seen.has(lut[120])).toBe(true);
    expect(hatchColours('dark').some(colour => seen.has(colour))).toBe(true);
    expect(ctx.pixel(34, 77)).toBe(lut[250]);
  });

  it('takes a null over any value, and a far value over a near one, under one pixel', () => {
    const g = geometry(4, 1);
    const pick = (codes: number[]) => {
      const ctx = fakeContext();
      paintGrid(ctx, 0, 0, 1, 1, g, Uint16Array.from(codes), lut, gridMaps(g, view(g), 1, 1), { scale: 1, mode: 'dark', highlight: null });
      return ctx.pixel(0, 0);
    };
    expect(hatchColours('dark')).toContain(pick([100, 100, NULL_CODE, 255]));
    // Whichever the median, and whichever comes first
    expect(hatchColours('dark')).toContain(pick([200, 200, NULL_CODE, 0]));
    expect(hatchColours('dark')).toContain(pick([NULL_CODE, 200, 200, 0]));
    expect(pick([200, 200, BELOW_CODE, 0])).toBe(lut[BELOW_CODE]);
    expect(pick([BELOW_CODE, 200, 200, 0])).toBe(lut[BELOW_CODE]);
    expect(pick([100, 100, 100, 255])).toBe(lut[255]);
    expect(pick([100, 100, 100, 0])).toBe(lut[0]);
  });

  it('points at the same cell it shows, and says how many share the pixel', () => {
    const g = geometry(4, 1);
    const codes = Uint16Array.from([100, 100, 255, 100]);
    expect(cellAtPixel(g, codes, gridMaps(g, view(g), 1, 1), 0, 0)).toEqual({ cell: 2, under: 4 });
    const nulled = Uint16Array.from([100, NULL_CODE, 255, 100]);
    expect(cellAtPixel(g, nulled, gridMaps(g, view(g), 1, 1), 0, 0)).toEqual({ cell: 1, under: 4 });
    const farther = Uint16Array.from([200, 200, NULL_CODE, 0]);
    expect(cellAtPixel(g, farther, gridMaps(g, view(g), 1, 1), 0, 0)).toEqual({ cell: 2, under: 4 });
  });

  it('points at nothing outside the picture', () => {
    const g = geometry(4, 1);
    const maps = gridMaps(g, view(g), 4, 4);
    const codes = new Uint16Array(4);
    expect(cellAtPixel(g, codes, maps, -1, 0)).toBeNull();
    expect(cellAtPixel(g, codes, maps, 4, 0)).toBeNull();
    expect(cellAtPixel(g, codes, maps, 0, 4)).toBeNull();
  });
});

describe('the view of the picture', () => {
  const cells = () => drawn(grid({ x: counting(10), y: counting(10).map(i => 60 - i), values: new Array(100).fill(1) }));

  it('fits a grid to its cells’ edges', () => {
    const c = cells();
    const g = c.geometry as GridGeometry;
    expect(fullView(c)).toEqual({ x0: g.xEdges[0], x1: g.xEdges[10], y0: g.yEdges[0], y1: g.yEdges[10] });
  });

  it('leaves room around points and polygons', () => {
    const polygons = drawn(triangles([1, 2]));
    const v = fullView(polygons);
    expect(v.x0).toBeLessThan(10);
    expect(v.x1).toBeGreaterThan(12);
    const points = drawn(pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    expect(fullView(points).x0).toBeLessThan(20);
    expect(fullView(points).x1).toBeGreaterThan(28);
  });

  it('goes back to fit when zoomed all the way out', () => {
    const c = cells();
    expect(clampView(c, fullView(c))).toBeNull();
    const { x0, x1, y0, y1 } = fullView(c);
    expect(clampView(c, { x0: x0 - 1, x1: x1 + 1, y0: y0 + 1, y1: y1 - 1 })).toBeNull();
  });

  it('keeps a zoomed view over the cells', () => {
    const c = cells();
    const full = fullView(c);
    const width = (full.x1 - full.x0) / 2;
    const height = (full.y0 - full.y1) / 2;
    const moved = clampView(c, { x0: full.x0 - 3, x1: full.x0 - 3 + width, y0: full.y0 + 2, y1: full.y0 + 2 - height })!;
    expect(moved.x0).toBe(full.x0);
    expect(moved.x1).toBeCloseTo(full.x0 + width, 8);
    expect(moved.y0).toBe(full.y0);
    const other = clampView(c, { x0: full.x1 + 3 - width, x1: full.x1 + 3, y0: full.y1 - 2 + height, y1: full.y1 - 2 })!;
    expect(other.x1).toBe(full.x1);
    expect(other.y1).toBe(full.y1);
  });

  it('makes ticks of nice numbers, within the range', () => {
    expect(ticks(0.4, 3.6, 3).list).toEqual([1, 2, 3]);
    expect(ticks(24.1, 24.9, 4).list).toEqual([24.2, 24.4, 24.6, 24.8]);
    expect(ticks(5, 5, 3).list).toEqual([5]);
  });

  it('fits the width, and stays within what it’s allowed to be tall', () => {
    const box = plotLayout(cells(), 500, null, 300);
    expect(box.plotH).toBe(300);
    expect(box.plotW).toBeLessThan(500);
    expect(box.height).toBe(300 + 30);
    expect(box.plotX + box.plotW).toBeLessThanOrEqual(500);
  });

  it('never goes taller than the width allows, whatever room there is', () => {
    const tall = drawn(grid({ x: [1, 2], y: counting(40).map(i => 60 - i), values: new Array(80).fill(1) }));
    expect(plotLayout(tall, 400, null, 5000).plotH).toBe(420);
  });

  it('keeps a single row tall enough to see', () => {
    const row = drawn(grid({ x: counting(50).map(i => i * 0.1), y: [60], values: new Array(50).fill(1) }));
    expect(plotLayout(row, 500, null, 500).plotH).toBeGreaterThanOrEqual(44);
  });

  it('draws one cell as a square, and leaves room for its labels', () => {
    const box = plotLayout(drawn(grid({ x: [10], y: [55], values: [1] })), 500, null, 500);
    expect(box.plotW).toBe(150);
    expect(box.plotH).toBe(150);
  });

  it('makes room at the left for the longest label', () => {
    const narrow = plotLayout(cells(), 500, null, 500).plotX;
    const fine = drawn(grid({ x: counting(10), y: counting(10).map(i => 60 - i * 0.001), values: new Array(100).fill(1) }));
    expect(plotLayout(fine, 500, null, 500).plotX).toBeGreaterThan(0);
    expect(narrow).toBeGreaterThan(0);
  });
});

describe('pointing', () => {
  const paintedGrid = (c: DrawableCells, width = 500, tallest = 500): PaintedPlot => {
    const box = plotLayout(c, width, null, tallest);
    const g = c.geometry as GridGeometry;
    return { box, maps: gridMaps(g, box.v, box.plotW, box.plotH), codes: new Uint16Array(c.cells), scale: 1 };
  };

  it('finds the cell under a grid’s pixel, and nothing outside it', () => {
    const c = drawn(grid({ x: [1, 2], y: [61, 60], values: [1, 2, 3, 4] }));
    const plot = paintedGrid(c);
    const { box } = plot;
    expect(hitTest(plot, c, box.plotX + box.plotW * 0.75, box.plotY + box.plotH * 0.25)).toEqual({ cell: 1, under: 1 });
    expect(hitTest(plot, c, box.plotX + box.plotW * 0.25, box.plotY + box.plotH * 0.75)).toEqual({ cell: 2, under: 1 });
    expect(hitTest(plot, c, box.plotX - 1, box.plotY)).toBeNull();
    expect(hitTest(plot, c, box.plotX, box.plotY + box.plotH)).toBeNull();
  });

  it('finds the nearest point, within reach', () => {
    const c = drawn(pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    const box = plotLayout(c, 500, null, 500);
    const plot: PaintedPlot = { box, maps: null, codes: new Uint16Array(c.cells), scale: 1 };
    const place = (i: number) => {
      const g = c.geometry;
      if (g.kind !== 'samples') throw new Error('Points expected');
      return [box.plotX + ((g.xs[i] - box.v.x0) / (box.v.x1 - box.v.x0)) * box.plotW, g.ys[i]];
    };
    const [x] = place(4);
    const y = box.plotY + box.plotH / 2;
    const found = hitTest(plot, c, x, y);
    expect(found === null || found.under === 1).toBe(true);
    expect(hitTest({ ...plot }, c, box.plotX + 1, box.plotY + 1)).toBeNull();
  });

  it('finds nothing outside the plot, though a point is near', () => {
    const c = drawn(pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    const box = plotLayout(c, 500, null, 500);
    const plot: PaintedPlot = { box, maps: null, codes: new Uint16Array(c.cells), scale: 1 };
    // The westernmost point, which is 4% of the view in from the edge, so pointed at from just past that edge
    const [x, y] = pixelOf(box, c.crs, 20, 50, 1);
    expect(hitTest(plot, c, x, y)).toEqual({ cell: 0, under: 1 });
    expect(hitTest(plot, c, box.plotX - 1, y)).toBeNull();
    expect(hitTest(plot, c, x, box.plotY + box.plotH + 1)).toBeNull();
  });

  it('finds the polygon a pixel is inside', () => {
    const c = drawn(triangles([1, 2]));
    const box = plotLayout(c, 500, null, 500);
    const plot: PaintedPlot = { box, maps: null, codes: new Uint16Array(c.cells), scale: 1 };
    // Low in the middle of each triangle: x 10.5 and 11.5, just above y 50
    const px = (lon: number) => box.plotX + ((lon - box.v.x0) / (box.v.x1 - box.v.x0)) * box.plotW;
    const bottom = box.plotY + box.plotH * 0.9;
    expect(hitTest(plot, c, px(10.5), bottom)?.cell).toBe(0);
    expect(hitTest(plot, c, px(11.5), bottom)?.cell).toBe(1);
    expect(hitTest(plot, c, px(11), box.plotY + box.plotH * 0.2)).toBeNull();
  });
});

describe('scaleText', () => {
  it('says how big a cell is', () => {
    const c = drawn(grid({ x: [1, 2], y: [61, 60], values: [1, 2, 3, 4] }));
    const box = plotLayout(c, 500, null, 500);
    expect(scaleText({ box, maps: null, codes: new Uint16Array(4), scale: 1 }, c)).toMatch(/^1 cell = \d+\.\d × \d+\.\d px$/);
  });

  it('says when cells share a pixel, and what the pixel shows', () => {
    const c = drawn(grid({ x: counting(1000).map(i => i * 0.001), y: [61, 60], values: new Array(2000).fill(1) }));
    const box = plotLayout(c, 500, null, 500);
    expect(scaleText({ box, maps: null, codes: new Uint16Array(2000), scale: 1 }, c)).toMatch(/^1 px holds up to \d+ × 1 cells, and shows the one that stands out$/);
  });

  it('says when a cell is a device pixel on a sharp screen', () => {
    const c = drawn(grid({ x: counting(700).map(i => i * 0.001), y: [60.002, 60], values: new Array(1400).fill(1) }));
    const box = plotLayout(c, 500, null, 500);
    expect(scaleText({ box, maps: null, codes: new Uint16Array(1400), scale: 2 }, c)).toBe('A cell is about a screen pixel. Zoom in to see them apart');
  });

  it('says what a point and a polygon are', () => {
    const polygons = drawn(triangles([1, 2]));
    const box = plotLayout(polygons, 500, null, 500);
    expect(scaleText({ box, maps: null, codes: new Uint16Array(2), scale: 1 }, polygons)).toBe('Each polygon as the response gives it');
    const points = drawn(pointCollection([[0, 0], [0.01, 0.01], [3, 3], [3.5, 9], [10, 1], [11, 12], [15, 15], [15.1, 15], [20, 2]].map(([x, y]) => pointCoverage(20 + x, 50 + y, { values: { a: [1] } }))));
    expect(scaleText({ box: plotLayout(points, 500, null, 500), maps: null, codes: new Uint16Array(9), scale: 1 }, points)).toBe('Each dot is a point. A dot has no area');
  });
});
