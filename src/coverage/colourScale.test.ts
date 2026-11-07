import { describe, expect, it } from 'vitest';
import { ABOVE_CODE, BELOW_CODE, NULL_CODE, OUTSIDE, abgr, encode, fadedNullColour, hatchColours, lutCss, lutFor, medianCode, rampGradient } from './colourScale';

const codesOf = (values: number[], lo: number, hi: number) => Array.from(encode(Float32Array.from(values), 0, values.length, lo, hi, new Uint16Array(values.length)));
const rgb = (colour: number) => [colour & 255, (colour >> 8) & 255, (colour >> 16) & 255];

describe('encode', () => {
  it('runs the range over the ramp, ends included', () => {
    expect(codesOf([0, 5, 10], 0, 10)).toEqual([0, 128, 255]);
  });

  it('gives what’s outside its own codes, never the end of the ramp', () => {
    expect(codesOf([-0.001, 10.001], 0, 10)).toEqual([BELOW_CODE, ABOVE_CODE]);
  });

  it('gives a null its own code', () => {
    expect(codesOf([NaN], 0, 10)).toEqual([NULL_CODE]);
  });

  it('copes with a range of no width', () => {
    expect(codesOf([3], 3, 3)).toEqual([0]);
  });

  it('reads from where it’s told, as a step is', () => {
    const out = encode(Float32Array.from([1, 2, 3, 4]), 2, 2, 3, 4, new Uint16Array(2));
    expect(Array.from(out)).toEqual([0, 255]);
  });
});

describe('medianCode', () => {
  it('is the middle of the codes on the ramp, and ignores the others', () => {
    expect(medianCode(Uint16Array.from([0, 10, 200, NULL_CODE, ABOVE_CODE, BELOW_CODE, NULL_CODE]))).toBe(10);
  });

  it('has an answer for nothing on the ramp', () => {
    expect(medianCode(Uint16Array.from([NULL_CODE]))).toBe(0);
  });
});

describe('lutFor', () => {
  it('starts and ends on viridis, the same in both themes', () => {
    const dark = lutFor('sequential', 'dark', null);
    const light = lutFor('sequential', 'light', null);
    expect(rgb(dark[0])).toEqual([0x44, 0x01, 0x54]);
    expect(rgb(dark[255])).toEqual([0xfd, 0xe7, 0x25]);
    expect(Array.from(dark)).toEqual(Array.from(light));
  });

  it('gets lighter all the way up, so that it reads in order', () => {
    const lut = lutFor('sequential', 'dark', null);
    const lightness = (colour: number) => {
      const [r, g, b] = rgb(colour);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (let code = 16; code < 256; code += 16) expect(lightness(lut[code])).toBeGreaterThan(lightness(lut[code - 16]));
  });

  it('has hot pink for what’s outside, at both ends', () => {
    const lut = lutFor('sequential', 'dark', null);
    expect(rgb(lut[BELOW_CODE])).toEqual(OUTSIDE);
    expect(rgb(lut[ABOVE_CODE])).toEqual(OUTSIDE);
  });

  it('has a neutral middle around 0, for each theme’s surface', () => {
    expect(rgb(lutFor('diverging', 'dark', null)[128])[0]).toBeLessThan(100);
    expect(rgb(lutFor('diverging', 'light', null)[128])[0]).toBeGreaterThan(200);
  });

  it('lights only a bar’s codes, and fades the rest', () => {
    const plain = lutFor('sequential', 'dark', null);
    const lit = lutFor('sequential', 'dark', { kind: 'bin', from: 4, to: 7, bin: 1 });
    expect(lit[4]).toBe(plain[4]);
    expect(lit[7]).toBe(plain[7]);
    expect(lit[3]).not.toBe(plain[3]);
    expect(lit[8]).not.toBe(plain[8]);
    expect(lit[BELOW_CODE]).not.toBe(plain[BELOW_CODE]);
  });

  it('lights what’s below or above by itself', () => {
    const plain = lutFor('sequential', 'dark', null);
    const below = lutFor('sequential', 'dark', { kind: 'below' });
    expect(below[BELOW_CODE]).toBe(plain[BELOW_CODE]);
    expect(below[ABOVE_CODE]).not.toBe(plain[ABOVE_CODE]);
    expect(below[100]).not.toBe(plain[100]);
    const above = lutFor('sequential', 'dark', { kind: 'above' });
    expect(above[ABOVE_CODE]).toBe(plain[ABOVE_CODE]);
    expect(above[BELOW_CODE]).not.toBe(plain[BELOW_CODE]);
  });

  it('fades towards the theme’s surface', () => {
    const fadedDark = rgb(lutFor('sequential', 'dark', { kind: 'null' })[255]);
    const fadedLight = rgb(lutFor('sequential', 'light', { kind: 'null' })[255]);
    expect(fadedDark[0]).toBeLessThan(100);
    expect(fadedLight[0]).toBeGreaterThan(200);
  });
});

describe('the rest of the colours', () => {
  it('writes a colour for CSS', () => {
    expect(lutCss(Uint32Array.from([abgr(1, 2, 3)]), 0)).toBe('rgb(1,2,3)');
  });

  it('is opaque unless asked otherwise', () => {
    expect(abgr(1, 2, 3) >>> 24).toBe(255);
    expect(abgr(1, 2, 3, 7) >>> 24).toBe(7);
  });

  it('gives the legend the ramp from end to end', () => {
    const gradient = rampGradient('sequential', 'dark');
    expect(gradient.startsWith('linear-gradient(to right, rgb(68,1,84)')).toBe(true);
    expect(gradient.endsWith('rgb(253,231,37))')).toBe(true);
  });

  it('has a hatch of two colours, and a faded null, per theme', () => {
    expect(hatchColours('dark')[0]).not.toBe(hatchColours('dark')[1]);
    expect(hatchColours('dark')).not.toEqual(hatchColours('light'));
    expect(fadedNullColour('dark')).not.toBe(fadedNullColour('light'));
  });
});
