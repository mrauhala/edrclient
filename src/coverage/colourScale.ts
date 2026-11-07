// Values to colours. A value has one colour everywhere: in the pane, on the map, and in both themes.

export type RampKind = 'sequential' | 'diverging';
export type ThemeMode = 'light' | 'dark';

// Codes above the ramp's 0 to 255
export const NULL_CODE = 256;
export const BELOW_CODE = 257;
export const ABOVE_CODE = 258;

// Outside the range, never clamped: clamping would hide exactly what this view is for
export const OUTSIDE: [number, number, number] = [255, 45, 149];
export const OUTSIDE_CSS = `rgb(${OUTSIDE.join(',')})`;

const VIRIDIS = ['#440154', '#482475', '#414487', '#355f8d', '#2a788e', '#21918c', '#22a884', '#44bf70', '#7ad151', '#bddf26', '#fde725'];
// Blue to red with a neutral middle that reads as nothing, for each theme's surface
const divergingStops = (mode: ThemeMode) => ['#0d366b', '#2a78d6', '#86b6ef', mode === 'dark' ? '#4a4a46' : '#f0efec', '#f2a48e', '#d6452a', '#7a1a0d'];

const fromHex = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

function rampOf(stops: string[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 3);
  const colours = stops.map(fromHex);
  for (let i = 0; i < 256; i++) {
    const at = (i / 255) * (colours.length - 1);
    const from = Math.min(Math.floor(at), colours.length - 2);
    const part = at - from;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = colours[from][k] + (colours[from + 1][k] - colours[from][k]) * part;
  }
  return out;
}

const SEQUENTIAL = rampOf(VIRIDIS);
const DIVERGING = { light: rampOf(divergingStops('light')), dark: rampOf(divergingStops('dark')) };
const rampFor = (kind: RampKind, mode: ThemeMode) => (kind === 'sequential' ? SEQUENTIAL : DIVERGING[mode]);

export function encode(data: Float32Array, from: number, cells: number, lo: number, hi: number, out: Uint16Array): Uint16Array {
  const factor = hi > lo ? 255 / (hi - lo) : 0;
  for (let i = 0; i < cells; i++) {
    const value = data[from + i];
    if (value !== value) out[i] = NULL_CODE;
    else if (value < lo) out[i] = BELOW_CODE;
    else if (value > hi) out[i] = ABOVE_CODE;
    else out[i] = ((value - lo) * factor + 0.5) | 0;
  }
  return out;
}

// The middle code, which "the cell that stands out" is measured from
export function medianCode(codes: Uint16Array): number {
  const counts = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < codes.length; i++) {
    if (codes[i] < 256) {
      counts[codes[i]]++;
      n++;
    }
  }
  let seen = 0;
  for (let i = 0; i < 256; i++) {
    seen += counts[i];
    if (seen * 2 >= n) return i;
  }
  return 128;
}

// Which cells are lit, from the legend. The rest fade
export type Highlight =
  | { kind: 'bin'; from: number; to: number; bin: number }
  | { kind: 'null' | 'below' | 'above' };

export const abgr = (r: number, g: number, b: number, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

export function lutFor(ramp: RampKind, mode: ThemeMode, highlight: Highlight | null): Uint32Array {
  const colours = rampFor(ramp, mode);
  const lut = new Uint32Array(259);
  const surface = mode === 'dark' ? [26, 26, 26] : [247, 247, 247];
  const put = (code: number, r: number, g: number, b: number, lit: boolean) => {
    if (lit) {
      lut[code] = abgr(r, g, b);
      return;
    }
    const fade = 0.82;
    lut[code] = abgr(r + (surface[0] - r) * fade, g + (surface[1] - g) * fade, b + (surface[2] - b) * fade);
  };
  for (let i = 0; i < 256; i++) {
    put(i, colours[i * 3], colours[i * 3 + 1], colours[i * 3 + 2], !highlight || (highlight.kind === 'bin' && i >= highlight.from && i <= highlight.to));
  }
  put(BELOW_CODE, ...OUTSIDE, !highlight || highlight.kind === 'below');
  put(ABOVE_CODE, ...OUTSIDE, !highlight || highlight.kind === 'above');
  return lut;
}

export const lutCss = (lut: Uint32Array, code: number) => {
  const colour = lut[code];
  return `rgb(${colour & 255},${(colour >> 8) & 255},${(colour >> 16) & 255})`;
};

// The ramp as a CSS gradient, for the legend and the map's key
export function rampGradient(ramp: RampKind, mode: ThemeMode): string {
  const lut = lutFor(ramp, mode, null);
  const stops: string[] = [];
  for (let code = 0; code <= 255; code += 15) stops.push(lutCss(lut, code));
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

// A null is a neutral hatch, not on the ramp, so it can't be read as low
export const hatchColours = (mode: ThemeMode): [number, number] => (mode === 'dark'
  ? [abgr(58, 58, 58), abgr(34, 34, 34)]
  : [abgr(190, 190, 190), abgr(236, 236, 236)]);

export const fadedNullColour = (mode: ThemeMode) => (mode === 'dark' ? abgr(30, 30, 30) : abgr(242, 242, 242));
