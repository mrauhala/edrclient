import { describe, expect, it } from 'vitest';
import { derefLocal, escapePointerSegment, findBrokenLocalRefs, pointerOf, resolvePointer, unescapePointerSegment } from './refs';

const doc = {
  paths: { '/collections/{id}/position': { get: { parameters: [{ $ref: '#/components/parameters/coords' }] } } },
  components: {
    parameters: {
      coords: { name: 'coords', in: 'query', schema: { $ref: '#/components/schemas/wkt' } },
      alias: { $ref: '#/components/parameters/coords' },
      loopA: { $ref: '#/components/parameters/loopB' },
      loopB: { $ref: '#/components/parameters/loopA' },
    },
    schemas: { wkt: { type: 'string' }, 'a~b': { type: 'number' } },
  },
};

describe('JSON pointers', () => {
  it('escapes and unescapes ~ and /', () => {
    expect(escapePointerSegment('/collections/{id}~x')).toBe('~1collections~1{id}~0x');
    expect(unescapePointerSegment('~1collections~1{id}~0x')).toBe('/collections/{id}~x');
    expect(pointerOf('paths', '/a/b', 0)).toBe('/paths/~1a~1b/0');
  });

  it('resolves pointers with or without #', () => {
    expect(resolvePointer(doc, '#/components/schemas/wkt')).toEqual({ type: 'string' });
    expect(resolvePointer(doc, '/paths/~1collections~1{id}~1position/get/parameters/0')).toEqual({ $ref: '#/components/parameters/coords' });
    expect(resolvePointer(doc, '/components/schemas/a~0b')).toEqual({ type: 'number' });
    expect(resolvePointer(doc, '#/nope/x')).toBeUndefined();
    expect(resolvePointer(doc, '')).toBe(doc);
  });
});

describe('derefLocal', () => {
  it('follows $ref chains', () => {
    expect(derefLocal(doc, { $ref: '#/components/parameters/alias' })).toMatchObject({ name: 'coords' });
    expect(derefLocal(doc, { type: 'string' })).toEqual({ type: 'string' });
  });

  it('gives up on broken and circular refs', () => {
    expect(derefLocal(doc, { $ref: '#/components/parameters/missing' })).toBeUndefined();
    expect(derefLocal(doc, { $ref: '#/components/parameters/loopA' })).toBeUndefined();
  });
});

describe('findBrokenLocalRefs', () => {
  it('lists refs that do not resolve, with their location', () => {
    const broken = { a: { $ref: '#/components/schemas/wkt' }, b: [{ $ref: '#/components/schemas/gone' }], c: { $ref: 'other.yaml#/x' } };
    expect(findBrokenLocalRefs({ ...broken, components: doc.components })).toEqual([{ at: '/b/0', ref: '#/components/schemas/gone' }]);
  });
});
