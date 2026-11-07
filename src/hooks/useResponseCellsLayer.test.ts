import { describe, expect, it } from 'vitest';
import type { Point, Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { canGoOnMap, cellAt, extentOf, markFeatures } from './useResponseCellsLayer';
import { readCells, type DrawableCells } from '../coverage/coverageCells';
import { counting, grid, pointCollection, pointCoverage, triangles } from '../coverage/cellsTestData';

const drawn = (json: unknown) => readCells(json) as DrawableCells;
const metres = (lon: number, lat: number) => fromLonLat([lon, lat]);

describe('cellAt, on the map', () => {
  const cells = drawn(grid({ x: [24, 25, 26], y: [61, 60], values: [1, 2, 3, 4, 5, 6] }));

  it('finds the cell at a place, by Web Mercator like the map', () => {
    expect(cellAt(cells, metres(24, 61), 100)).toBe(0);
    expect(cellAt(cells, metres(26, 61), 100)).toBe(2);
    expect(cellAt(cells, metres(25, 60), 100)).toBe(4);
    expect(cellAt(cells, metres(25.4, 60.4), 100)).toBe(4);
    expect(cellAt(cells, metres(25.6, 60.6), 100)).toBe(2);
  });

  it('finds nothing beyond the edges, half a cell out', () => {
    expect(cellAt(cells, metres(23.4, 60), 100)).toBeNull();
    expect(cellAt(cells, metres(26.6, 60), 100)).toBeNull();
    expect(cellAt(cells, metres(25, 61.6), 100)).toBeNull();
    expect(cellAt(cells, metres(25, 59.4), 100)).toBeNull();
  });

  it('finds the nearest point within a reach in pixels, at the map’s zoom', () => {
    const points = drawn(pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    const [x, y] = metres(22, 55);
    expect(cellAt(points, [x + 100, y], 10)).toBe(2);
    expect(cellAt(points, [x + 100, y], 1)).toBeNull();
  });

  it('finds the polygon a place is inside', () => {
    const polygons = drawn(triangles([1, 2]));
    expect(cellAt(polygons, metres(10.5, 50.2), 100)).toBe(0);
    expect(cellAt(polygons, metres(11.5, 50.2), 100)).toBe(1);
    expect(cellAt(polygons, metres(11, 50.9), 100)).toBeNull();
  });
});

describe('markFeatures', () => {
  it('outlines a cell, and marks its middle, which may be smaller than a pixel', () => {
    const cells = drawn(grid({ x: [24, 25, 26], y: [61, 60], values: [1, 2, 3, 4, 5, 6] }));
    const [outline, middle] = markFeatures(cells, 4);
    const ring = (outline.getGeometry() as Polygon).getCoordinates()[0];
    expect(ring).toHaveLength(5);
    expect(ring[0][0]).toBeCloseTo(metres(24.5, 60)[0], 3);
    expect(ring[1][0]).toBeCloseTo(metres(25.5, 60)[0], 3);
    expect(ring[0][1]).toBeCloseTo(metres(24, 60.5)[1], 0);
    expect(ring[2][1]).toBeCloseTo(metres(24, 59.5)[1], 0);
    expect((middle.getGeometry() as Point).getCoordinates()[0]).toBeCloseTo(metres(25, 60)[0], 3);
  });

  it('marks a point where it is', () => {
    const points = drawn(pointCollection(counting(9).map(i => pointCoverage(20 + i, 50 + (i * 7) % 9, { values: { a: [i] } }))));
    const [mark] = markFeatures(points, 2);
    const [x, y] = (mark.getGeometry() as Point).getCoordinates();
    expect(x).toBeCloseTo(metres(22, 55)[0], 3);
    expect(y).toBeCloseTo(metres(22, 55)[1], 1);
  });

  it('outlines a polygon as sent', () => {
    const [mark] = markFeatures(drawn(triangles([1, 2])), 1);
    const ring = (mark.getGeometry() as Polygon).getCoordinates()[0];
    expect(ring).toHaveLength(4);
    expect(ring[2][0]).toBeCloseTo(metres(11.5, 51)[0], 3);
    expect(ring[2][1]).toBeCloseTo(metres(11.5, 51)[1], 1);
  });
});

describe('extentOf', () => {
  it('is the grid’s edges in the map’s metres', () => {
    const [west, south, east, north] = extentOf(drawn(grid({ x: [24, 25], y: [61, 60], values: [1, 2, 3, 4] })));
    expect(west).toBeCloseTo(metres(23.5, 60)[0], 3);
    expect(east).toBeCloseTo(metres(25.5, 60)[0], 3);
    expect(south).toBeCloseTo(metres(24, 59.5)[1], 0);
    expect(north).toBeCloseTo(metres(24, 61.5)[1], 0);
  });
});

describe('canGoOnMap', () => {
  it('takes what’s lon/lat, and opens as a picture', () => {
    expect(canGoOnMap(drawn(grid()))).toBe(true);
  });

  it('leaves out what the map can’t place', () => {
    expect(canGoOnMap(drawn(grid({ x: [4000000, 4001000], y: [3000000, 2999000], values: [1, 2, 3, 4], referencing: null })))).toBe(false);
  });

  it('leaves out a few places, which have their own markers and a chart', () => {
    expect(canGoOnMap(drawn(pointCollection([pointCoverage(20, 50, { values: { a: [1] } }), pointCoverage(21, 53, { values: { a: [2] } })])))).toBe(false);
  });
});
