import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './chunkLoadError';

describe('isChunkLoadError', () => {
  it("recognizes each browser's failed dynamic import", () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x.web.app/assets/index-RzYxrL-8.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x.web.app/assets/index-RzYxrL-8.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/index-DmDe01mr.css'))).toBe(true);
  });

  it('leaves other errors alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
