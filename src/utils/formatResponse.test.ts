import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration } from './formatResponse';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [189, '189 B'],
    [999, '999 B'],
    [1000, '1.0 KB'],
    [7600, '7.6 KB'],
    [99_940, '99.9 KB'],
    [99_960, '100 KB'],
    [100_000, '100 KB'],
    [999_400, '999 KB'],
    [999_500, '1.0 MB'],
    [1_234_000, '1.2 MB'],
    [2_500_000_000, '2.5 GB'],
    [5_000_000_000_000, '5000 GB'],
  ])('%d bytes is %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 ms'],
    [94.4, '94 ms'],
    [999.4, '999 ms'],
    [999.6, '1.00 s'],
    [2230, '2.23 s'],
    [9994, '9.99 s'],
    [9996, '10.0 s'],
    [12_900, '12.9 s'],
    [125_400, '125.4 s'],
  ])('%d ms is %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
