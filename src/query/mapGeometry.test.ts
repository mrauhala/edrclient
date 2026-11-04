import { describe, expect, it } from 'vitest';
import { withoutLastCorner, withoutLastPoint } from './mapGeometry';

type LonLat = [number, number];
const a: LonLat = [1, 1];
const b: LonLat = [2, 2];
const c: LonLat = [3, 3];
const d: LonLat = [4, 4];

describe('withoutLastPoint', () => {
  it('removes the newest point, down to none', () => {
    expect(withoutLastPoint([a, b], 'points')).toEqual([a]);
    expect(withoutLastPoint([a], 'points')).toEqual([]);
    expect(withoutLastPoint([], 'points')).toEqual([]);
  });

  it('removes the newest vertex of a line, and the line when one vertex would be left', () => {
    expect(withoutLastPoint([a, b, c], 'line')).toEqual([a, b]);
    expect(withoutLastPoint([a, b], 'line')).toEqual([]);
    expect(withoutLastPoint([], 'line')).toEqual([]);
  });

  it('leaves the given points as they were', () => {
    const points = [a, b];
    withoutLastPoint(points, 'points');
    expect(points).toEqual([a, b]);
  });
});

describe('withoutLastCorner', () => {
  it('removes the newest corner and keeps the ring closed', () => {
    expect(withoutLastCorner([[a, b, c, d, a]])).toEqual([[a, b, c, a]]);
  });

  it('removes a triangle as a whole', () => {
    expect(withoutLastCorner([[a, b, c, a]])).toEqual([]);
  });

  it('touches only the newest polygon', () => {
    const first = [a, b, c, a];
    expect(withoutLastCorner([first, [a, b, c, d, a]])).toEqual([first, [a, b, c, a]]);
    expect(withoutLastCorner([first, [b, c, d, b]])).toEqual([first]);
  });

  it('has nothing to remove from no polygons', () => {
    expect(withoutLastCorner([])).toEqual([]);
  });
});
