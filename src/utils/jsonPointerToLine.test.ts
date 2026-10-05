import { describe, expect, it } from 'vitest';
import { findLineForJsonPointer } from './jsonPointerToLine';

describe('findLineForJsonPointer', () => {
  const doc = {
    paths: {
      '/collections/{collectionId}/position': { get: { parameters: [{ name: 'coords' }, { name: 'f' }] } },
      '/a~b': { get: {} },
    },
  };
  const pretty = JSON.stringify(doc, null, 2);
  const lineOf = (text: string) => pretty.split('\n').findIndex(line => line.includes(text)) + 1;

  it('unescapes ~1 and ~0 in OpenAPI path keys', () => {
    expect(findLineForJsonPointer(pretty, '/paths/~1collections~1{collectionId}~1position')).toBe(lineOf('"/collections/{collectionId}/position"'));
    expect(findLineForJsonPointer(pretty, '/paths/~1a~0b')).toBe(lineOf('"/a~b"'));
  });

  it('resolves array items below escaped keys', () => {
    expect(findLineForJsonPointer(pretty, '/paths/~1collections~1{collectionId}~1position/get/parameters/1'))
      .toBe(lineOf('"name": "f"') - 1);
  });
});
