import { describe, expect, it } from 'vitest';
import { convertLength, pickUnit, rangeFor, unitToMeters } from './units';

describe('length units', () => {
  it('knows the units servers list, whatever their spelling', () => {
    expect(unitToMeters('km')).toBe(1000);
    expect(unitToMeters('mi')).toBe(unitToMeters('miles'));
    expect(unitToMeters(' M ')).toBe(1);
    expect(unitToMeters('furlong')).toBeNull();
  });

  it('converts keeping the physical size, rounded to the slider step', () => {
    expect(convertLength(10, 'km', 'm')).toBe(10000);
    expect(convertLength(10, 'km', 'mi')).toBe(6);
    expect(convertLength(10000, 'm', 'km')).toBe(10);
    expect(convertLength(100, 'm', 'km')).toBe(1); // never below the slider minimum
    expect(convertLength(10, 'km', 'furlong')).toBe(10);
  });

  it('gives slider ranges by unit, also for spelling variants', () => {
    expect(rangeFor('km')).toEqual({ min: 1, max: 500, step: 1 });
    expect(rangeFor('miles')).toEqual(rangeFor('mi'));
    expect(rangeFor('m').max).toBe(50000);
    expect(rangeFor('furlong')).toEqual(rangeFor('km'));
  });

  it('picks the current unit if offered, else km, else the first', () => {
    expect(pickUnit(['km', 'mi'], 'mi')).toBe('mi');
    expect(pickUnit(['m', 'km', 'miles'], 'mi')).toBe('km');
    expect(pickUnit(['m'], 'km')).toBe('m');
    expect(pickUnit([], 'km')).toBe('km');
  });
});
