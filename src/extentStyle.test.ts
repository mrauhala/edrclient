import { describe, expect, it } from 'vitest';
import Feature from 'ol/Feature';
import type Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import type { Style } from 'ol/style';
import { extentStyle } from './extentStyle';

const box = (bboxIndex: number) => new Feature({
  geometry: new Polygon([[[10, 20], [30, 20], [30, 40], [10, 40], [10, 20]]]),
  bboxIndex,
});
const styles = (bboxIndex = 0) => extentStyle(box(bboxIndex)) as Style[];

describe('extentStyle', () => {
  it('only outlines the box, so that the map keeps its colours', () => {
    for (const style of styles()) expect(style.getFill()).toBeNull();
  });

  it('draws white dashes over a dark line, to show on any layer', () => {
    const [casing, dashes] = styles();
    expect(casing.getStroke()?.getColor()).toBe('rgba(0, 0, 0, 0.45)');
    expect(casing.getStroke()?.getWidth()).toBe(3);
    expect(casing.getStroke()?.getLineDash()).toBeNull();
    expect(dashes.getStroke()?.getColor()).toBe('rgba(255, 255, 255, 0.85)');
    expect(dashes.getStroke()?.getWidth()).toBe(1.25);
    expect(dashes.getStroke()?.getLineDash()).toEqual([6, 5]);
  });

  describe('the label', () => {
    const label = () => styles()[2];

    it('says what the box is, in plain words', () => {
      const text = label().getText()?.getText() as string[];
      expect(text[0]).toBe('Collection extent');
      expect(text).toContain('where it says it has data');
      expect(text).toContain('\n');
    });

    it('sits inside the bottom right corner', () => {
      const place = label().getGeometryFunction()(box(0)) as Point;
      expect(place.getCoordinates()).toEqual([30, 20]);
      const text = label().getText();
      expect(text?.getTextAlign()).toBe('right');
      expect(text?.getTextBaseline()).toBe('bottom');
      expect(text?.getOffsetX()).toBeLessThan(0);
      expect(text?.getOffsetY()).toBeLessThan(0);
    });

    it('stays readable over anything, with a dark edge', () => {
      const text = label().getText();
      expect(text?.getFill()?.getColor()).toBe('rgba(255, 255, 255, 0.92)');
      expect(text?.getStroke()?.getColor()).toBe('rgba(0, 0, 0, 0.8)');
      expect(text?.getStroke()?.getWidth()).toBe(3);
    });

    it('is only on the first box, which is the overall extent', () => {
      expect(styles(0)).toHaveLength(3);
      expect(styles(1)).toHaveLength(2);
      expect(styles(5)).toHaveLength(2);
      for (const style of styles(1)) expect(style.getText()).toBeNull();
    });
  });

  it('shares its styles, not making them anew at every render', () => {
    expect(extentStyle(box(0))).toBe(extentStyle(box(0)));
    expect(extentStyle(box(1))).toBe(extentStyle(box(2)));
  });
});
