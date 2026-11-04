import { describe, expect, it } from 'vitest';
import { takesMapGeometry } from './queryTypes';

describe('takesMapGeometry', () => {
  it.each(['position', 'radius', 'trajectory', 'corridor', 'area', 'cube', 'items'])('is true for %s', queryType => {
    expect(takesMapGeometry(queryType)).toBe(true);
  });

  it.each(['locations', 'instances', 'metadata', ''])('is false for "%s"', queryType => {
    expect(takesMapGeometry(queryType)).toBe(false);
  });
});
