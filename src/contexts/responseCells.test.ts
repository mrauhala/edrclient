import { describe, expect, it, vi } from 'vitest';
import { INITIAL_CHOICES, afterNewResponse, createHoverStore, pictureOf } from './responseCells';
import { readCells } from '../coverage/coverageCells';
import { grid } from '../coverage/cellsTestData';

describe('afterNewResponse', () => {
  const before = {
    ...INITIAL_CHOICES,
    parameterId: 'a',
    steps: { t: 2 },
    ramp: 'diverging' as const,
    onMap: false,
    opacity: 0.3,
    range: 'set' as const,
    setLo: 1,
    setHi: 2,
    scope: 'this' as const,
    flip: 'ns' as const,
    zoom: { x0: 0, x1: 1, y0: 1, y1: 0 },
    pin: 7,
    litPinned: { kind: 'null' as const },
    litHover: { kind: 'above' as const },
  };

  it('keeps what’s being watched, and how it’s shown', () => {
    expect(afterNewResponse(before)).toMatchObject({ parameterId: 'a', steps: { t: 2 }, ramp: 'diverging', onMap: false, opacity: 0.3 });
  });

  it('drops what was about the last one, the flip above all', () => {
    expect(afterNewResponse(before)).toMatchObject({ range: 'auto', setLo: null, setHi: null, scope: null, flip: 'none', zoom: null, pin: null, litPinned: null, litHover: null });
  });
});

describe('pictureOf', () => {
  const two = () => {
    const json = grid({ x: [1, 2], y: [60], t: ['2026-11-07T06:00:00Z', '2026-11-07T07:00:00Z'], values: [0, 10, 20, 30], id: 'a' }) as { ranges: Record<string, unknown> };
    json.ranges.b = { type: 'NdArray', axisNames: ['t', 'y', 'x'], shape: [2, 1, 2], values: [100, 200, 300, 400] };
    return readCells(json);
  };

  it('has nothing to draw without cells', () => {
    expect(pictureOf(null, INITIAL_CHOICES)).toBeNull();
    expect(pictureOf(readCells({}), INITIAL_CHOICES)).toBeNull();
  });

  it('starts on the first parameter and step', () => {
    expect(pictureOf(two(), INITIAL_CHOICES)).toMatchObject({ parameter: { id: 'a' }, slice: 0, scope: 'all', lo: 0, hi: 30 });
  });

  it('follows the parameter chosen, and falls back if this response hasn’t got it', () => {
    expect(pictureOf(two(), { ...INITIAL_CHOICES, parameterId: 'b' })?.parameter.id).toBe('b');
    expect(pictureOf(two(), { ...INITIAL_CHOICES, parameterId: 'gone' })?.parameter.id).toBe('a');
  });

  it('colours the step chosen on the shared scale', () => {
    const picture = pictureOf(two(), { ...INITIAL_CHOICES, steps: { t: 1 } })!;
    expect(picture.slice).toBe(1);
    expect(Array.from(picture.codes)).toEqual([170, 255]);
  });

  it('applies the flip and the range chosen', () => {
    expect(Array.from(pictureOf(two(), { ...INITIAL_CHOICES, flip: 'ew' })!.codes)).toEqual([85, 0]);
    expect(pictureOf(two(), { ...INITIAL_CHOICES, range: 'set', setLo: 5, setHi: 6 })).toMatchObject({ lo: 5, hi: 6 });
    expect(pictureOf(two(), { ...INITIAL_CHOICES, scope: 'this', steps: { t: 1 } })).toMatchObject({ scope: 'this', lo: 20, hi: 30 });
  });
});

describe('createHoverStore', () => {
  it('tells its listeners when the cell changes, and only then', () => {
    const store = createHoverStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ cell: 1, under: 1 });
    expect(store.get()).toEqual({ cell: 1, under: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    store.set({ cell: 1, under: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    store.set({ cell: 1, under: 4 });
    expect(listener).toHaveBeenCalledTimes(2);
    store.set(null);
    expect(store.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    store.set(null);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('stops telling those who’ve gone', () => {
    const store = createHoverStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ cell: 1, under: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
