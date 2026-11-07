import { describe, expect, it } from 'vitest';
import { analyse, shareText } from './cellFigures';

const figuresOf = (values: (number | null)[], slices = 1) => analyse(Float32Array.from(values, value => value ?? NaN), slices, values.length / slices);
const ramp = (n: number, from = 0, step = 1) => Array.from({ length: n }, (_, i) => from + i * step);

describe('shareText', () => {
  it('rounds, and never says 100% or 0% for what isn’t', () => {
    expect(shareText(0.5)).toBe('50%');
    expect(shareText(0.9996)).toBe('100.0%');
    expect(shareText(0.995)).toBe('99.5%');
    expect(shareText(0.0001)).toBe('0.01%');
    expect(shareText(1)).toBe('100%');
    expect(shareText(0)).toBe('0%');
  });
});

describe('analyse', () => {
  it('adds up numbers and nulls, overall and per step', () => {
    const figures = figuresOf([1, 2, null, 4, null, null], 2);
    expect(figures).toMatchObject({ total: 6, numbers: 3, nulls: 3, min: 1, max: 4 });
    expect(figures.mean).toBeCloseTo(7 / 3, 8);
    expect(figures.perSlice).toEqual([
      { numbers: 2, nulls: 1, min: 1, max: 2, mean: 1.5 },
      { numbers: 1, nulls: 2, min: 4, max: 4, mean: 4 },
    ]);
  });

  it('has nothing to say of all null but that', () => {
    expect(figuresOf([null, null])).toMatchObject({ numbers: 0, nulls: 2, mean: null, min: null, max: null, lo: null, hi: null, oneValue: false, spike: null, apart: [] });
    expect(figuresOf([null, null]).perSlice[0]).toEqual({ numbers: 0, nulls: 2, min: null, max: null, mean: null });
  });

  it('knows one value when it sees it, and doesn’t call it a spike', () => {
    expect(figuresOf([3, 3, 3])).toMatchObject({ oneValue: true, spike: null, lo: 3, hi: 3, apart: [] });
  });

  it('sets apart a fill value, however many cells have it', () => {
    const figures = figuresOf([...ramp(1000, 290.6, 0.001), ...new Array(300).fill(-1e34)]);
    expect(figures.apart).toEqual([expect.objectContaining({ count: 300, low: true })]);
    expect(figures.lo).toBeCloseTo(290.6, 3);
    expect(figures.min).toBeLessThan(-1e33);
  });

  it('sets apart a sentinel that is nearly all of the cells', () => {
    const figures = figuresOf([...ramp(30, 0, 1), ...new Array(970).fill(-64.003)]);
    expect(figures.apart[0]).toMatchObject({ count: 970, low: true });
    expect(figures.lo).toBe(0);
  });

  it('sets apart one value far off, either way', () => {
    expect(figuresOf([...ramp(1000, 0, 0.01), 9999]).apart[0]).toMatchObject({ count: 1, low: false, min: 9999, max: 9999 });
    expect(figuresOf([...ramp(1000, 0, 0.01), -9999]).apart[0]).toMatchObject({ count: 1, low: true });
  });

  it('sets apart a scattered few of different values', () => {
    const figures = figuresOf([...ramp(1000, 0, 0.01), 500, 501, 502]);
    expect(figures.apart[0]).toMatchObject({ count: 3, min: 500, max: 502, low: false });
    expect(figures.hi).toBeCloseTo(9.99, 3);
  });

  it('sets apart both ends at once, where each would count the other as part of the rest', () => {
    const figures = figuresOf([...ramp(1000, 0, 0.01), 9999, -9999]);
    expect(figures.apart).toEqual([
      { min: -9999, max: -9999, count: 1, low: true },
      { min: 9999, max: 9999, count: 1, low: false },
    ]);
    expect(figures.lo).toBe(0);
    expect(figures.hi).toBeCloseTo(9.99, 3);
  });

  it('sets apart both ends unevenly, and a fill value that’s most of the cells', () => {
    const figures = figuresOf([...ramp(100, 0, 0.1), ...new Array(500).fill(-1e30), 1e30]);
    expect(figures.apart.map(apart => apart.count).sort((a, b) => a - b)).toEqual([1, 500]);
    expect(figures.lo).toBe(0);
  });

  it('takes more among a handful of values, where a natural gradient looks like a gap', () => {
    expect(figuresOf([-2, 0, 5]).apart).toEqual([]);
    expect(figuresOf([1, 2, 3, 4, 5, 6, 7, 8, 40]).apart).toEqual([]);
    expect(figuresOf([12, 13, 14, -9999]).apart).toEqual([{ min: -9999, max: -9999, count: 1, low: true }]);
    expect(figuresOf([...ramp(9), 100]).apart).toEqual([{ min: 100, max: 100, count: 1, low: false }]);
  });

  it('doesn’t take two ends as far off when the middle isn’t tight between them', () => {
    expect(figuresOf([0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30]).apart).toEqual([]);
  });

  it('doesn’t take many scattered values at both ends as far off', () => {
    const figures = figuresOf([...ramp(50, -1000, 1), ...ramp(100, 0, 0.1), ...ramp(50, 1000, 1)]);
    expect(figures.apart).toEqual([]);
  });

  it('keeps a long tail on the scale, as heavy rain is', () => {
    const tail = ramp(1000).map(i => 0.1 * Math.exp(i / 150));
    expect(figuresOf(tail).apart).toEqual([]);
  });

  it('keeps a two-peaked field on the scale', () => {
    expect(figuresOf([...ramp(500, 0, 0.01), ...ramp(500, 100, 0.01)]).apart).toEqual([]);
  });

  it('keeps the next value on the scale when it’s close, as -32 beside -31.5 is', () => {
    const figures = figuresOf([...new Array(640).fill(-32), ...ramp(360, -31.5, 0.2)]);
    expect(figures.apart).toEqual([]);
    expect(figures.spike).toMatchObject({ value: -32, count: 640, atLow: true });
    expect(figures.spike?.share).toBeCloseTo(0.64, 8);
  });

  it('notes a spike at the top of the range too, and not one in the middle', () => {
    expect(figuresOf([...ramp(300), ...new Array(200).fill(300)]).spike).toMatchObject({ value: 300, atLow: false });
    expect(figuresOf([...ramp(300), ...new Array(200).fill(150.5), ...ramp(300, 301)]).spike).toBeNull();
  });

  it('notes no spike under a fifth of the cells', () => {
    expect(figuresOf([...new Array(19).fill(0), ...ramp(81, 1)]).spike).toBeNull();
    expect(figuresOf([...new Array(20).fill(0), ...ramp(80, 1)]).spike).not.toBeNull();
  });

  it('leaves a lot of far off values alone if they’re spread out, which is a second peak', () => {
    const figures = figuresOf([...ramp(100, 0, 0.1), ...ramp(10, 1000, 1)]);
    expect(figures.apart).toEqual([]);
  });

  describe('above what it sorts', () => {
    const big = () => {
      const values = new Float32Array(1_500_000);
      for (let i = 0; i < values.length; i++) values[i] = 280 + (i % 5000) * 0.004;
      values[777_777] = -9999;
      values[1_234_567] = NaN;
      for (let i = 0; i < 40; i++) values[900_000 + i * 11] = 1e30;
      return values;
    };

    it('still has the exact counts and ends', () => {
      const figures = analyse(big(), 1, 1_500_000);
      expect(figures.total).toBe(1_500_000);
      expect(figures.nulls).toBe(1);
      expect(figures.min).toBe(-9999);
      expect(figures.max).toBe(Math.fround(1e30));
    });

    it('still finds a lone value, which a sample alone could miss, and counts what’s set apart exactly', () => {
      const figures = analyse(big(), 1, 1_500_000);
      expect(figures.apart.find(apart => apart.low)).toMatchObject({ count: 1, min: -9999, max: -9999 });
      expect(figures.apart.find(apart => !apart.low)?.count).toBe(40);
      expect(figures.lo).toBeGreaterThanOrEqual(280);
      expect(figures.hi).toBeLessThan(300);
    });

    it('still finds a lone value at the top, at a place a sample skips', () => {
      const values = new Float32Array(1_500_000);
      for (let i = 0; i < values.length; i++) values[i] = 280 + (i % 5000) * 0.004;
      values[1_000_001] = 1e30;
      const figures = analyse(values, 1, 1_500_000);
      expect(figures.max).toBe(Math.fround(1e30));
      expect(figures.apart).toEqual([{ min: Math.fround(1e30), max: Math.fround(1e30), count: 1, low: false }]);
    });

    it('keeps the rest’s own ends on the scale, though the sample missed them', () => {
      const values = new Float32Array(1_500_000);
      for (let i = 0; i < values.length; i++) values[i] = 280 + (i % 5000) * 0.004;
      values[1_000_001] = 1e30;
      values[3] = -9999;
      const figures = analyse(values, 1, 1_500_000);
      // 299.996 is only at odd places, which a sample of every other value skips
      expect(figures.hi).toBe(Math.fround(299.996));
      expect(figures.lo).toBe(280);
      expect(figures.apart.map(apart => [apart.low, apart.count]).sort()).toEqual([[false, 1], [true, 1]]);
    });

    it('finds a far value the sample skipped, beside one it saw', () => {
      const values = new Float32Array(1_500_000);
      for (let i = 0; i < values.length; i++) values[i] = 280 + (i % 5000) * 0.004;
      values[400_001] = -9999;
      values[400_003] = 9999;
      values[2] = 1e30;
      const figures = analyse(values, 1, 1_500_000);
      expect(figures.apart.map(apart => [apart.min, apart.count]).sort((a, b) => a[0] - b[0])).toEqual([[-9999, 1], [9999, 1], [Math.fround(1e30), 1]]);
      expect([figures.lo, figures.hi]).toEqual([280, Math.fround(299.996)]);
    });

    it('counts two far off groups on one side each as its own', () => {
      const values = new Float32Array(1_500_000);
      for (let i = 0; i < values.length; i++) values[i] = 280 + (i % 5000) * 0.004;
      for (let i = 0; i < 6; i++) values[11 + i * 2] = -1e34;
      values[400_001] = -9999;
      const figures = analyse(values, 1, 1_500_000);
      const lows = figures.apart.filter(apart => apart.low).map(apart => [apart.min, apart.count]);
      expect(lows).toEqual([[Math.fround(-1e34), 6], [-9999, 1]]);
      expect(figures.lo).toBe(280);
    });

    it('doesn’t count again what’s set apart when it looks at what the sample missed', () => {
      // 8000 fill values, 0.4%, all at places the sample sees, and the rest's lowest at places it doesn't. Counted twice,
      // the fill values would come to more than 1% of what's looked at, and go on the scale
      const values = new Float32Array(2_000_000);
      for (let i = 0; i < values.length; i++) values[i] = i % 250 === 0 ? -9999 + ((i / 250) % 10) : 280 + (i % 1000) / 50;
      const figures = analyse(values, 1, 2_000_000);
      expect(figures.apart).toEqual([{ min: -9999, max: -9990, count: 8000, low: true }]);
      expect([figures.lo, figures.hi]).toEqual([Math.fround(280.02), Math.fround(299.98)]);
    });

    it('sets apart fill values at every place the sample skips, by its true ends', () => {
      // Every third value is sampled, and the fill values are only ever between: more than 1% at each end
      const values = new Float32Array(2_200_000);
      for (let i = 0; i < values.length; i++) values[i] = 280 + (i % 1000) / 50;
      for (let i = 0; i < 90_000; i += 3) {
        values[i + 1] = -9999;
        values[i + 2] = 9999;
      }
      const figures = analyse(values, 1, 2_200_000);
      expect(figures.apart).toEqual([
        { min: -9999, max: -9999, count: 30_000, low: true },
        { min: 9999, max: 9999, count: 30_000, low: false },
      ]);
      expect([figures.lo, figures.hi]).toEqual([280, Math.fround(299.98)]);
    });

    it('counts a spike exactly, though it looked at a sample', () => {
      const values = new Float32Array(1_200_000);
      for (let i = 0; i < values.length; i++) values[i] = i % 2 === 0 ? -32 : -30 + (i % 7000) * 0.01;
      expect(analyse(values, 1, 1_200_000).spike).toMatchObject({ value: -32, count: 600_000, atLow: true });
    });
  });
});
