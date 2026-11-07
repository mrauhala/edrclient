import { analyse, type CellFigures } from './cellFigures';
import { ABOVE_CODE, BELOW_CODE, NULL_CODE, encode, type RampKind } from './colourScale';
import { pointerPart, stepsOfSlice, type CellGeometry, type CellNote, type CellParameter, type DrawableCells, type StepAxis } from './coverageCells';
import { parseTime, utcMoment } from '../utils/utcTime';

// What the choices in the view come to: which values, in which colours. No DOM.

export type RangeMode = 'auto' | 'all' | 'set';
export type RangeScope = 'all' | 'this';
export type Flip = 'none' | 'ns' | 'ew';

// Before the first paint a step may be one from a response with more of them
export const stepOf = (dim: StepAxis, steps: Record<string, number>) => Math.max(0, Math.min(dim.values.length - 1, steps[dim.name] ?? 0));
export const sliceIndex = (dims: StepAxis[], steps: Record<string, number>) => dims.reduce((slice, dim) => slice * dim.values.length + stepOf(dim, steps), 0);

// Times share a scale, so a colour means the same in each. Levels don't by default: a temperature at 500 hPa and at
// 1000 hPa are 25 K apart, and one scale over both leaves each level flat
export const scopeOf = (cells: DrawableCells, scope: RangeScope | null): RangeScope => (cells.slices <= 1 ? 'all' : scope ?? (cells.dims.some(dim => dim.name === 'z') ? 'this' : 'all'));

const scoped = new WeakMap<CellParameter, Map<string, CellFigures>>();

export function figuresInScope(parameter: CellParameter, cells: DrawableCells, scope: RangeScope, steps: Record<string, number>): CellFigures {
  if (scope === 'all') return parameter.figures;
  const z = cells.dims.find(dim => dim.name === 'z');
  const key = z ? `z${stepOf(z, steps)}` : `s${sliceIndex(cells.dims, steps)}`;
  let known = scoped.get(parameter);
  if (!known) {
    known = new Map();
    scoped.set(parameter, known);
  }
  const cached = known.get(key);
  if (cached) return cached;
  const slices: number[] = [];
  if (z) {
    for (let slice = 0; slice < cells.slices; slice++) if (stepsOfSlice(cells.dims, slice).z === stepOf(z, steps)) slices.push(slice);
  } else {
    slices.push(sliceIndex(cells.dims, steps));
  }
  const values = new Float32Array(slices.length * cells.cells);
  slices.forEach((slice, i) => values.set(parameter.data.subarray(slice * cells.cells, (slice + 1) * cells.cells), i * cells.cells));
  const figures = analyse(values, slices.length, cells.cells);
  known.set(key, figures);
  return figures;
}

export function colourRange(
  figures: CellFigures, range: RangeMode, setLo: number | null, setHi: number | null, ramp: RampKind,
): [number | null, number | null] {
  let lo = figures.lo;
  let hi = figures.hi;
  if (range === 'all') {
    lo = figures.min;
    hi = figures.max;
  }
  if (range === 'set' && setLo !== null && setHi !== null && setHi > setLo) {
    lo = setLo;
    hi = setHi;
  }
  if (ramp === 'diverging' && lo !== null && hi !== null) {
    const furthest = Math.max(Math.abs(lo), Math.abs(hi));
    lo = -furthest;
    hi = furthest;
  }
  return [lo, hi];
}

// The array place a drawn cell comes from, when the picture is flipped to test a guess
export function sourceCell(geometry: CellGeometry, cell: number, flip: Flip): number {
  if (geometry.kind !== 'grid') return cell;
  const row = Math.floor(cell / geometry.nx);
  const col = cell - row * geometry.nx;
  return (flip === 'ns' ? geometry.ny - 1 - row : row) * geometry.nx + (flip === 'ew' ? geometry.nx - 1 - col : col);
}

export function codesFor(parameter: CellParameter, cells: DrawableCells, slice: number, lo: number | null, hi: number | null, flip: Flip): Uint16Array {
  const out = new Uint16Array(cells.cells);
  encode(parameter.data, slice * cells.cells, cells.cells, lo ?? 0, hi ?? 0, out);
  if (flip === 'none' || cells.geometry.kind !== 'grid') return out;
  const flipped = new Uint16Array(out.length);
  for (let i = 0; i < out.length; i++) flipped[i] = out[sourceCell(cells.geometry, i, flip)];
  return flipped;
}

export interface Tallies {
  bins: Uint32Array;
  nulls: number;
  below: number;
  above: number;
}

// The legend's bars: a bar per 1/64th of the range, and one each for nulls and what's outside it
export function tallies(codes: Uint16Array): Tallies {
  const bins = new Uint32Array(64);
  let nulls = 0;
  let below = 0;
  let above = 0;
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (code < 256) bins[code >> 2]++;
    else if (code === NULL_CODE) nulls++;
    else if (code === BELOW_CODE) below++;
    else if (code === ABOVE_CODE) above++;
  }
  return { bins, nulls, below, above };
}

// How much of each step is there, whatever the other axes are set to, so a bad step shows before you reach it
export function stepKinds({ dims, slices }: DrawableCells, parameter: CellParameter, dim: StepAxis): ('' | 'some' | 'none')[] {
  const numbers = new Float64Array(dim.values.length);
  const nulls = new Float64Array(dim.values.length);
  for (let slice = 0; slice < slices; slice++) {
    const step = stepsOfSlice(dims, slice)[dim.name];
    numbers[step] += parameter.figures.perSlice[slice].numbers;
    nulls[step] += parameter.figures.perSlice[slice].nulls;
  }
  return dim.values.map((_, step) => (numbers[step] === 0 ? 'none' : nulls[step] > 0 ? 'some' : ''));
}

export function stepLabel(cells: DrawableCells, dim: StepAxis, step: number): string {
  const value = dim.values[step];
  if (dim.name === 't') {
    const time = parseTime(value);
    return Number.isNaN(time) ? String(value) : utcMoment(time);
  }
  return `${String(value)}${dim.name === 'z' && cells.zUnit ? ` ${cells.zUnit}` : ''}`;
}

// The label as the step bar shows it
export const stepCaption = (cells: DrawableCells, dim: StepAxis, step: number) => `${stepLabel(cells, dim, step)} (${step + 1}/${dim.values.length})`;

// The longest of a step's captions, so that its bar keeps its width from one step to the next
export const longestStepCaption = (cells: DrawableCells, dim: StepAxis) => dim.values.reduce<number>((most, _, step) => Math.max(most, stepCaption(cells, dim, step).length), 0);

const longestOf = (values: ArrayLike<number>) => {
  let longest = '';
  for (let i = 0; i < values.length; i++) {
    const text = String(values[i]);
    if (text.length > longest.length) longest = text;
  }
  return longest;
};

// A double as long as JavaScript writes one
const LONGEST_NUMBER = '-1.7976931348623157e+308';

// What the readout holds at its longest for this parameter, whichever cell is pointed at, so that the room for it can be
// kept and the readout doesn't change height as the pointer moves
export function longestReadout({ geometry: g, dims, slices, cells, coverageCount }: DrawableCells, parameter: CellParameter) {
  const lengths: Record<string, number> = Object.fromEntries(dims.map(dim => [dim.name, dim.values.length]));
  let place: string;
  if (g.kind === 'grid') {
    lengths.x = g.nx;
    lengths.y = g.ny;
    place = `x ${longestOf(g.xs)}, y ${longestOf(g.ys)}`;
  } else if (g.kind === 'samples') {
    place = `x ${longestOf(g.xs)}, y ${longestOf(g.ys)}`;
  } else {
    lengths.composite = g.cells;
    place = 'about x -180.00000, y -90.00000';
  }
  lengths.coverage = coverageCount ?? 1;
  const names = g.kind === 'samples' || coverageCount ? ['coverage'] : parameter.indicesAt(0, 0).map(([name]) => name);
  const indices = names.map(name => `${name} ${(lengths[name] ?? 1) - 1}`).join(', ');
  const tail = `/ranges/${pointerPart(parameter.id)}/values/${(coverageCount ? slices : slices * cells) - 1}`;
  return {
    value: `${LONGEST_NUMBER}${parameter.unit ? ` ${parameter.unit}` : ''}`,
    under: 'one of 999 under this pixel',
    where: `[${indices}] ${place}`,
    pointer: coverageCount ? `/coverages/${coverageCount - 1}${tail}` : tail,
  };
}

// The notes for what's showing: this parameter's, and what's true of the whole response
export function notesFor(cells: DrawableCells, parameter: CellParameter, url: string): CellNote[] {
  const notes = cells.notes.filter(note => !note.parameter || note.parameter === parameter.id);
  const others = cells.parameters.filter(other => other.id !== parameter.id && other.figures.numbers === 0).map(other => other.id);
  if (others.length) {
    notes.push({
      level: 'warn',
      text: `${others.length === 1 ? '1 other parameter is' : `${others.length} other parameters are`} all null: ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` and ${others.length - 3} more` : ''}`,
    });
  }
  const noUnit = cells.parameters.filter(other => other.unit === '');
  if (noUnit.length === cells.parameters.length && noUnit.length > 1) notes.push({ level: 'info', text: `None of the ${noUnit.length} parameters has a unit` });
  else if (parameter.unit === '') notes.push({ level: 'info', text: `${parameter.id} has no unit` });
  if (/[?&]datetime=/.test(url) && !('t' in cells.fixed) && !cells.dims.some(dim => dim.name === 't')) {
    notes.push({ level: 'info', text: "You asked for a datetime, and the response has no t axis, so it doesn't say which time this is" });
  }
  return notes;
}

// The cells in a parameter's order at this step, nulls last whichever way, for reaching the worst cells at once
export function sortedCells(parameter: CellParameter, cells: DrawableCells, slice: number, direction: 1 | -1): Uint32Array {
  const from = slice * cells.cells;
  const { data } = parameter;
  return Uint32Array.from({ length: cells.cells }, (_, i) => i).sort((a, b) => {
    const first = data[from + a];
    const second = data[from + b];
    if (first !== first) return second !== second ? 0 : 1;
    if (second !== second) return -1;
    return direction * (first - second);
  });
}

// A table page's rows, in exact values: rows are built only for the page, so a million cells cost one page
export function cellRows(cells: DrawableCells, from: number, to: number, order: Uint32Array | null, slice: number, flip: Flip): Record<string, unknown>[] {
  const g = cells.geometry;
  const end = Math.min(to, cells.cells);
  const rows: Record<string, unknown>[] = [];
  for (let i = from; i < end; i++) {
    const cell = order ? order[i] : i;
    const source = sourceCell(g, cell, flip);
    const row: Record<string, unknown> = { id: cell };
    if (g.kind === 'grid') {
      const at = Object.fromEntries(cells.parameters[0].indicesAt(source, slice));
      const gridRow = Math.floor(cell / g.nx);
      row.yi = at.y ?? gridRow;
      row.xi = at.x ?? cell - gridRow * g.nx;
      row.y = g.ys[gridRow];
      row.x = g.xs[cell - gridRow * g.nx];
    } else if (g.kind === 'samples') {
      row.coverage = cells.parameters[0].rawAt(cell, slice).coverage ?? '';
      row.x = g.xs[cell];
      row.y = g.ys[cell];
    } else {
      row.composite = cell;
    }
    cells.parameters.forEach((parameter, index) => {
      row[`p${index}`] = parameter.rawAt(source, slice).value;
    });
    rows.push(row);
  }
  return rows;
}

// The picture opens by itself for anything with at least 9 places or a real grid. Fewer series open on Chart
export const opensAsPicture = (cells: DrawableCells) => cells.geometry.kind !== 'samples' || cells.cells >= 9;

// The same cell asked for by /position, the general test for flips, offsets and axis order, since /position usually
// goes down a different path in the server. Null if the request wasn't for an area
export function positionUrl(url: string, cells: DrawableCells, parameter: CellParameter, cell: number, steps: Record<string, number>): string | null {
  const g = cells.geometry;
  if (g.kind === 'polygons' || !/\/(area|cube)(\?|$)/.test(url)) return null;
  const [path, query = ''] = url.split('?');
  const sent = new URLSearchParams(query);
  let x: number;
  let y: number;
  if (g.kind === 'grid') {
    const row = Math.floor(cell / g.nx);
    y = g.ys[row];
    x = g.xs[cell - row * g.nx];
  } else {
    x = g.xs[cell];
    y = g.ys[cell];
  }
  const valueOf = (name: string) => {
    const dim = cells.dims.find(axis => axis.name === name);
    return dim ? dim.values[stepOf(dim, steps)] : cells.fixed[name];
  };
  const parts = [`coords=${encodeURIComponent(`POINT(${x} ${y})`)}`];
  const time = valueOf('t') ?? sent.get('datetime');
  if (time) parts.push(`datetime=${encodeURIComponent(String(time))}`);
  const level = valueOf('z') ?? sent.get('z');
  if (level !== null && level !== undefined) parts.push(`z=${encodeURIComponent(String(level))}`);
  parts.push(`parameter-name=${encodeURIComponent(parameter.id)}`);
  for (const name of ['crs', 'f']) {
    const value = sent.get(name);
    if (value) parts.push(`${name}=${encodeURIComponent(value)}`);
  }
  return `${path.replace(/\/(area|cube)$/, '/position')}?${parts.join('&')}`;
}
