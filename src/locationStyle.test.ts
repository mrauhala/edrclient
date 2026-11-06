import { describe, expect, it } from 'vitest';
import type Circle from 'ol/style/Circle';
import { locationHitTolerance, locationStyle } from './locationStyle';

const marker = (geometryType: string, selected: boolean) => locationStyle(geometryType, selected).getImage() as Circle;

describe('locationStyle', () => {
  describe('a marker', () => {
    it('is small, blue, and kept apart from its neighbours by a dark edge', () => {
      const dot = marker('Point', false);
      expect(dot.getRadius()).toBe(3.5);
      expect(dot.getFill()?.getColor()).toBe('#42A5F5');
      expect(dot.getStroke()?.getColor()).toBe('rgba(8, 16, 24, 0.85)');
      expect(dot.getStroke()?.getWidth()).toBe(1.25);
    });

    it('stands out when selected: bigger, orange, and the only one with a white edge', () => {
      const dot = marker('Point', true);
      expect(dot.getRadius()).toBe(6);
      expect(dot.getFill()?.getColor()).toBe('#FF9800');
      expect(dot.getStroke()?.getColor()).toBe('#ffffff');
      expect(dot.getStroke()?.getWidth()).toBe(2);
    });

    it('draws the selected one above the others', () => {
      expect(locationStyle('Point', true).getZIndex()).toBeGreaterThan(locationStyle('Point', false).getZIndex() ?? 0);
    });

    it('also marks a MultiPoint, which would otherwise not show at all', () => {
      expect(locationStyle('MultiPoint', false)).toBe(locationStyle('Point', false));
      expect(locationStyle('MultiPoint', true)).toBe(locationStyle('Point', true));
    });

    it('is shared, not made anew at every render', () => {
      expect(locationStyle('Point', false)).toBe(locationStyle('Point', false));
      expect(locationStyle('Point', true)).toBe(locationStyle('Point', true));
    });
  });

  describe('anything else', () => {
    const strokeOf = (geometryType: string, selected: boolean) => {
      const stroke = locationStyle(geometryType, selected).getStroke();
      return [stroke?.getColor(), stroke?.getWidth()];
    };
    const fillOf = (geometryType: string, selected: boolean) => locationStyle(geometryType, selected).getFill()?.getColor();

    it('draws lines as before', () => {
      for (const type of ['LineString', 'MultiLineString']) {
        expect(strokeOf(type, false)).toEqual(['#2196F3', 4]);
        expect(strokeOf(type, true)).toEqual(['#FF9800', 6]);
        expect(fillOf(type, false)).toBeUndefined();
      }
    });

    it('draws polygons as before', () => {
      for (const type of ['Polygon', 'MultiPolygon']) {
        expect(strokeOf(type, false)).toEqual(['#2196F3', 3]);
        expect(strokeOf(type, true)).toEqual(['#FF9800', 4]);
        expect(fillOf(type, false)).toBe('rgba(33, 150, 243, 0.3)');
        expect(fillOf(type, true)).toBe('rgba(255, 152, 0, 0.4)');
      }
    });

    it('draws other geometry as before', () => {
      expect(strokeOf('GeometryCollection', false)).toEqual(['#2196F3', 2]);
      expect(strokeOf('GeometryCollection', true)).toEqual(['#FF9800', 3]);
      expect(fillOf('GeometryCollection', false)).toBe('rgba(33, 150, 243, 0.2)');
      expect(fillOf('GeometryCollection', true)).toBe('rgba(255, 152, 0, 0.3)');
    });
  });
});

describe('locationHitTolerance', () => {
  it('gives a finger more room than a mouse', () => {
    expect(locationHitTolerance(false)).toBe(5);
    expect(locationHitTolerance(true)).toBe(12);
  });
});
