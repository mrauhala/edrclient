import { describe, expect, it } from 'vitest';
import { mapInputRequired } from './edrRules';

describe('mapInputRequired', () => {
  it('is true for queries that need a point, line, area or box drawn on the map', () => {
    for (const type of ['position', 'radius', 'area', 'cube', 'trajectory', 'corridor']) expect(mapInputRequired(type), type).toBe(true);
  });

  it("is false where the map is optional or not used, and for types EDR doesn't define", () => {
    for (const type of ['items', 'locations', 'instances', 'tiles', 'constructor', '']) expect(mapInputRequired(type), type).toBe(false);
  });
});
