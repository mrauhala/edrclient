import { describe, expect, it, vi } from 'vitest';
import { parseTime, utcClock, utcDay, utcMoment } from './utcTime';

const NOV_8 = Date.UTC(2026, 10, 8, 6, 5);

describe('reading out a time', () => {
  it('writes it in UTC on a 24-hour clock', () => {
    expect(utcClock(NOV_8)).toBe('06:05');
    expect(utcClock(Date.UTC(2026, 10, 8, 18, 30))).toBe('18:30');
    expect(utcDay(NOV_8)).toBe('Nov 8');
    expect(utcMoment(NOV_8)).toBe('Nov 8 06:05');
  });

  it('takes a Date as well', () => {
    expect(utcMoment(new Date(NOV_8))).toBe('Nov 8 06:05');
  });
});

describe('parseTime', () => {
  it.each([
    ['2026-11-08T06:05:00Z'],
    ['2026-11-08T06:05:00.000Z'],
    ['2026-11-08T06:05:00+00:00'],
    ['2026-11-08T08:05:00+02:00'],
    ['2026-11-08T08:05:00+0200'],
    ['2026-11-08T08:05:00+02'],
    ['2026-11-08T06:05Z'],
    ['2026-11-08t06:05:00z'],
  ])('reads %s', text => {
    expect(parseTime(text)).toBe(NOV_8);
  });

  it('takes a time with no zone as UTC', () => {
    expect(parseTime('2026-11-08T06:05:00')).toBe(NOV_8);
  });

  it('drops digits past milliseconds, as pygeoapi sends them', () => {
    expect(parseTime('2026-11-08T06:05:00.000000000')).toBe(NOV_8);
    expect(parseTime('2026-11-08T06:05:00.123456789Z')).toBe(NOV_8 + 123);
  });

  it('asks the browser only for what every browser can read', () => {
    const parse = vi.spyOn(Date, 'parse');
    parseTime('2026-11-08t06:05:00.123456789z');
    expect(parse).toHaveBeenCalledWith('2026-11-08T06:05:00.123Z');
    parseTime('2026-11-08T08:05:00+02');
    expect(parse).toHaveBeenCalledWith('2026-11-08T08:05:00+02:00');
    parse.mockRestore();
  });

  it('reads a date alone', () => {
    expect(parseTime('2026-11-08')).toBe(Date.UTC(2026, 10, 8));
  });

  it.each([['soon'], [''], [12], [null], [undefined]])('has no time for %s', text => {
    expect(parseTime(text)).toBeNaN();
  });
});
