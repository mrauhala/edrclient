import { describe, expect, it } from 'vitest';
import { timeIsOnlyAFilter } from './queryModel';

describe('timeIsOnlyAFilter', () => {
  it.each(['position', 'radius', 'area', 'cube', 'trajectory', 'corridor'])('lets the time select the data of a %s query', queryType => {
    expect(timeIsOnlyAFilter(queryType, false)).toBe(false);
  });

  it('lets it select the data of one location', () => {
    expect(timeIsOnlyAFilter('locations', true)).toBe(false);
  });

  it('only filters a list of locations', () => {
    expect(timeIsOnlyAFilter('locations', false)).toBe(true);
  });

  it('only filters items, location or not', () => {
    expect(timeIsOnlyAFilter('items', false)).toBe(true);
    expect(timeIsOnlyAFilter('items', true)).toBe(true);
  });

  it('has no opinion on no query', () => {
    expect(timeIsOnlyAFilter('', false)).toBe(false);
  });
});
