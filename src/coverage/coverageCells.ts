import { analyse, shareText, type CellFigures } from './cellFigures';
import { formatValue } from './coverageSummary';
import { parameterLabel, parameterUnit } from '../utils/coverageTimeSeries';
import { parseTime } from '../utils/utcTime';

// A parsed CoverageJSON response in, what can be drawn out, or why not. It reads the response, and assumes nothing
// about it: real APIs answer an area or a cube with a Grid, with thousands of Point coverages, with stations or with
// triangles. No DOM.

type Json = Record<string, unknown>;

export interface CellCrs {
  declared: boolean;
  geographic: boolean;
  label: string;
  inDegrees?: boolean;
}

export interface GridGeometry {
  kind: 'grid';
  nx: number;
  ny: number;
  cells: number;
  // Left to right, top to bottom: north up and west left, whatever the array's order
  xs: number[];
  ys: number[];
  xEdges: Float64Array;
  // Top to bottom, in the display's y: Web Mercator's for lon/lat, in which a lon/lat grid stays rectilinear
  yEdges: Float64Array;
  assumedSize: boolean;
  fromPoints?: boolean;
}

export interface SamplesGeometry {
  kind: 'samples';
  cells: number;
  xs: Float64Array;
  ys: Float64Array;
  spacing: { km: number | null; regular: boolean };
}

export interface PolygonsGeometry {
  kind: 'polygons';
  cells: number;
  pts: Float64Array;
  offsets: Uint32Array;
  bbox: [number, number, number, number];
}

export type CellGeometry = GridGeometry | SamplesGeometry | PolygonsGeometry;

export interface StepAxis {
  name: string;
  values: unknown[];
}

export interface CellRaw {
  value: unknown;
  index: number | null;
  pointer: string | null;
  coverage: number | null;
  absent?: boolean;
}

interface ParameterBase {
  id: string;
  label: string | null;
  unit: string;
}

export interface CellParameter extends ParameterBase {
  // Per step, per cell, in the geometry's order. NaN for what isn't a number
  data: Float32Array;
  figures: CellFigures;
  notNumbers: number;
  rawAt: (cell: number, slice: number) => CellRaw;
  indicesAt: (cell: number, slice: number) => [string, number][];
}

export interface BrokenParameter extends ParameterBase {
  problem: string;
}

export interface CellNote {
  level: 'info' | 'warn' | 'error';
  text: string;
  parameter?: string;
}

export interface DrawableCells {
  drawable: true;
  source: 'grid' | 'points' | 'points-grid' | 'polygons';
  viewLabel: 'Grid' | 'Points' | 'Cells';
  domainType: string;
  geometry: CellGeometry;
  dims: StepAxis[];
  fixed: Record<string, unknown>;
  slices: number;
  cells: number;
  crs: CellCrs;
  parameters: CellParameter[];
  broken: BrokenParameter[];
  notes: CellNote[];
  // Where values[0] is
  order: { firstX: 'left' | 'right'; firstY: 'top' | 'bottom' } | null;
  zUnit: string;
  // The coverages it was put together from, if there were several
  coverageCount: number | null;
}

export interface UndrawableCells {
  drawable: false;
  reason: string;
  // 'other-view': it's a line or a place, not cells on a plane. 'too-large': it can be drawn if asked for
  why: 'cant' | 'other-view' | 'too-large';
}

export type CellsReading = DrawableCells | UndrawableCells;

const isObj = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;
export const pointerPart = (text: string) => text.replace(/~/g, '~0').replace(/\//g, '~1');
const cant = (reason: string, why: UndrawableCells['why'] = 'cant'): UndrawableCells => ({ drawable: false, reason, why });

// ---- Axes ----------------------------------------------------------------------------------

export function axisValues(axis: unknown): unknown[] | null {
  if (!isObj(axis)) return null;
  if (Array.isArray(axis.values)) return axis.values;
  const { start, stop, num } = axis;
  if (isNum(start) && isNum(stop) && isNum(num) && num >= 1) {
    const out = new Array<number>(num);
    const step = num > 1 ? (stop - start) / (num - 1) : 0;
    for (let i = 0; i < num; i++) out[i] = start + i * step;
    return out;
  }
  return null;
}

function runsOneWay(values: number[]): boolean {
  if (values.length < 2) return true;
  const up = values[1] > values[0];
  for (let i = 1; i < values.length; i++) if (up ? !(values[i] > values[i - 1]) : !(values[i] < values[i - 1])) return false;
  return true;
}

// Cell edges: half way between centres, half a step beyond the ends. With one value there's no step
function edgesOf(ascending: number[], fallbackStep: number): Float64Array {
  const n = ascending.length;
  const edges = new Float64Array(n + 1);
  if (n === 1) {
    edges[0] = ascending[0] - fallbackStep / 2;
    edges[1] = ascending[0] + fallbackStep / 2;
    return edges;
  }
  for (let i = 1; i < n; i++) edges[i] = (ascending[i - 1] + ascending[i]) / 2;
  edges[0] = ascending[0] - (ascending[1] - ascending[0]) / 2;
  edges[n] = ascending[n - 1] + (ascending[n - 1] - ascending[n - 2]) / 2;
  return edges;
}

// An axis can give each cell's edges itself, in bounds: [from, to, from, to, ...]. DMI does for a cell of its own.
// Used when they meet end to end, which a picture needs, and otherwise the edges are worked out as usual
function boundsEdges(axis: unknown, order: ArrayLike<number>, n: number): Float64Array | null {
  const bounds = isObj(axis) ? axis.bounds : null;
  if (!Array.isArray(bounds) || bounds.length !== n * 2 || !bounds.every(isNum)) return null;
  const numbers = bounds as number[];
  const lows: number[] = [];
  const highs: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = numbers[order[k] * 2];
    const b = numbers[order[k] * 2 + 1];
    lows.push(Math.min(a, b));
    highs.push(Math.max(a, b));
  }
  for (let k = 1; k < n; k++) if (Math.abs(lows[k] - highs[k - 1]) > (highs[n - 1] - lows[0]) * 1e-6) return null;
  return Float64Array.from([...lows, highs[n - 1]]);
}

// How even an axis is: its step's spread, and how far it strays from a straight line, in cells
export function axisDrift(values: number[]) {
  if (values.length < 3) return null;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 1; i < values.length; i++) {
    const distance = Math.abs(values[i] - values[i - 1]);
    if (distance < min) min = distance;
    if (distance > max) max = distance;
  }
  const step = (values[values.length - 1] - values[0]) / (values.length - 1);
  let strayed = 0;
  for (let i = 0; i < values.length; i++) strayed = Math.max(strayed, Math.abs(values[i] - (values[0] + step * i)));
  return { min, max, spread: (max - min) / Math.abs(step), strayCells: strayed / Math.abs(step) };
}

// Web Mercator's y, the map's own, in degrees: a lon/lat grid stays rectilinear in it, so the pane and the map agree
export const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85.06, Math.min(85.06, lat)) * Math.PI) / 360)) * (180 / Math.PI);
export const invMercY = (y: number) => (Math.atan(Math.exp((y * Math.PI) / 180)) * 360) / Math.PI - 90;

function crsOf(referencing: unknown, xs: number[], ys: number[]): CellCrs {
  const entry = Array.isArray(referencing)
    ? (referencing as unknown[]).find(item => isObj(item) && Array.isArray(item.coordinates) && item.coordinates.includes('x')) as Json | undefined
    : undefined;
  const system = entry && isObj(entry.system) ? entry.system : null;
  const id = system && typeof system.id === 'string' ? system.id : null;
  const inDegrees = xs.every(v => v >= -360 && v <= 360) && ys.every(v => v >= -90 && v <= 90);
  if (!system) return { declared: false, geographic: inDegrees, label: 'not declared' };
  const geographic = system.type === 'GeographicCRS' || /CRS84|4326|WGS ?84/i.test(id ?? '');
  const label = id ? id.replace(/^.*\/def\/crs\//, '').replace(/\/0\//, ':').replace('OGC/1.3/', '') : String(system.type ?? 'unnamed');
  return { declared: true, geographic, label, inDegrees };
}

function zUnitOf(referencing: unknown): string {
  const entry = Array.isArray(referencing)
    ? (referencing as unknown[]).find(item => isObj(item) && Array.isArray(item.coordinates) && item.coordinates.includes('z')) as Json | undefined
    : undefined;
  const system = entry && isObj(entry.system) ? entry.system : null;
  const cs = system && isObj(system.cs) ? system.cs : null;
  const axis = cs && Array.isArray(cs.csAxes) && isObj(cs.csAxes[0]) ? cs.csAxes[0] : null;
  const unit = axis && isObj(axis.unit) ? axis.unit.symbol : null;
  if (typeof unit === 'string') return unit;
  if (isObj(unit) && typeof unit.value === 'string') return unit.value;
  const description = system && isObj(system.description) ? system.description.en : null;
  const said = typeof description === 'string' ? /in\s+(\S+)$/.exec(description) : null;
  return said ? said[1] : '';
}

// ---- A range, read through its own axis order -------------------------------------------------

// Says why a range can't be read as these axes, in numbers an API developer can check
function rangeProblem(id: string, range: unknown, axisLen: Record<string, number>): string | null {
  if (typeof range === 'string') return `${id}: its values are at a link, not in this response`;
  if (!isObj(range)) return `${id}: its range isn't an object`;
  if (range.type === 'TiledNdArray' || Array.isArray(range.tileSets)) return `${id}: a TiledNdArray keeps its values in tiles, which would take more requests`;
  if (!Array.isArray(range.values)) return `${id}: its range has no values array`;
  const names = Array.isArray(range.axisNames) ? (range.axisNames as string[]) : null;
  const shape = Array.isArray(range.shape) ? (range.shape as number[]) : null;
  if (!names || !shape) return null;
  if (names.length !== shape.length) return `${id}: axisNames has ${names.length} names, shape has ${shape.length}`;
  const product = shape.reduce((a, b) => a * b, 1);
  if (product !== range.values.length) return `${id}: shape ${shape.join(' × ')} makes ${count(product)} values, and values has ${count(range.values.length)}`;
  for (let i = 0; i < names.length; i++) {
    if (!(names[i] in axisLen)) return `${id}: axisNames has "${names[i]}", which isn't an axis of the domain`;
    if (shape[i] !== axisLen[names[i]]) return `${id}: shape says ${names[i]} has ${count(shape[i])} values, and the axis has ${count(axisLen[names[i]])}`;
  }
  return null;
}

// How many values along each named axis one step moves in a flat values array
function stridesOf(range: Json, fallbackOrder: string[], axisLen: Record<string, number>): Record<string, number> {
  const names = Array.isArray(range.axisNames)
    ? (range.axisNames as string[])
    : fallbackOrder.filter(name => axisLen[name] > 1 || fallbackOrder.length === 1);
  const shape = Array.isArray(range.shape) ? (range.shape as number[]) : names.map(name => axisLen[name]);
  const strides: Record<string, number> = {};
  let stride = 1;
  for (let i = names.length - 1; i >= 0; i--) {
    strides[names[i]] = stride;
    stride *= shape[i];
  }
  return strides;
}

function sliceOffsets(dims: StepAxis[], strides: Record<string, number>): Int32Array {
  const total = dims.reduce((a, dim) => a * dim.values.length, 1);
  const out = new Int32Array(total);
  for (let slice = 0; slice < total; slice++) {
    let rest = slice;
    let offset = 0;
    for (let d = dims.length - 1; d >= 0; d--) {
      const length = dims[d].values.length;
      offset += (rest % length) * (strides[dims[d].name] ?? 0);
      rest = Math.floor(rest / length);
    }
    out[slice] = offset;
  }
  return out;
}

// Where a slice is along each axis
export function stepsOfSlice(dims: StepAxis[], slice: number): Record<string, number> {
  const steps: Record<string, number> = {};
  let rest = slice;
  for (let d = dims.length - 1; d >= 0; d--) {
    const length = dims[d].values.length;
    steps[dims[d].name] = rest % length;
    rest = Math.floor(rest / length);
  }
  return steps;
}

// ---- Parameters -------------------------------------------------------------------------------

function parameterBase(id: string, definition: unknown): ParameterBase {
  const def = isObj(definition) ? definition : undefined;
  const label = parameterLabel(id, def as Parameters<typeof parameterLabel>[1]);
  return { id, label: label === id ? null : label, unit: parameterUnit(def as Parameters<typeof parameterUnit>[0]) };
}

// ---- Reading a response ---------------------------------------------------------------------

const NOT_A_PLANE = /trajectory|verticalprofile|section|corridor/i;
const ONE_PLACE = /^(point|pointseries|polygon|polygonseries)$/i;
// More than this isn't drawn until it's asked for
export const MOST_VALUES_DRAWN = 5000000;

function valuesIn(coverages: Json[]): number {
  let total = 0;
  for (const coverage of coverages) {
    if (!isObj(coverage.ranges)) continue;
    for (const range of Object.values(coverage.ranges)) if (isObj(range) && Array.isArray(range.values)) total += range.values.length;
  }
  return total;
}

export function readCells(json: unknown, { drawAnyway = false }: { drawAnyway?: boolean } = {}): CellsReading {
  if (!isObj(json)) return cant('This response is not a coverage', 'other-view');
  const isCollection = json.type === 'CoverageCollection' && Array.isArray(json.coverages);
  if (json.type !== 'Coverage' && !isCollection) return cant('This response is not a coverage', 'other-view');
  const coverages = isCollection ? (json.coverages as unknown[]).filter(isObj) : [json];
  if (coverages.length === 0) return cant('The collection has no coverages', 'other-view');
  const paramDefs = isObj(json.parameters) ? json.parameters : {};
  const topRef = json.referencing;

  const first = coverages[0];
  if (!isObj(first.domain)) return cant(typeof first.domain === 'string' ? 'The domain is at a link, not in this response' : 'The coverage has no domain');
  const type = String(first.domain.domainType ?? json.domainType ?? '');
  if (NOT_A_PLANE.test(type)) return cant(`A ${type} is a line through the data, not cells on a plane`, 'other-view');
  if (!drawAnyway) {
    const values = valuesIn(coverages);
    if (values > MOST_VALUES_DRAWN) return cant(`${count(values)} values is more than this draws by itself`, 'too-large');
  }
  const axes = isObj(first.domain.axes) ? first.domain.axes : {};
  if (isObj(axes.composite)) {
    const values = Array.isArray(axes.composite.values) ? axes.composite.values : [];
    const looksPolygon = Array.isArray(values[0]) && Array.isArray(values[0][0]) && Array.isArray(values[0][0][0]);
    if (coverages.length === 1 && looksPolygon) {
      // One polygon is one place, which a chart says better. DWD answers a position with one
      return values.length > 1 ? readPolygons(first, type, paramDefs, topRef) : cant(`A ${type || 'polygon'} of one polygon is one place`, 'other-view');
    }
    const coordinates = axes.composite.coordinates;
    if (coverages.length === 1 && Array.isArray(coordinates) && coordinates.includes('x') && !coordinates.includes('t') && !coordinates.includes('z')) {
      return readMultiPoint(first, type, paramDefs, topRef);
    }
    return cant(`A composite axis of ${Array.isArray(coordinates) ? coordinates.join(', ') : 'unknown coordinates'} isn't cells on a plane`, 'other-view');
  }

  const lengthOf = (coverage: Json, name: string) => axisValues(isObj(coverage.domain) && isObj(coverage.domain.axes) ? coverage.domain.axes[name] : null)?.length ?? 0;
  const allPoints = coverages.every(coverage => isObj(coverage.domain) && lengthOf(coverage, 'x') === 1 && lengthOf(coverage, 'y') === 1);
  if (coverages.length > 1) {
    if (allPoints) return readPoints(coverages, type, paramDefs, topRef);
    return cant(`${plural(coverages.length, 'coverage')} with axes of their own: the Table has them, one by one`);
  }
  // One place is a chart's, not a picture's, whatever it's called: DMI answers a position with a Grid of one cell, over time
  if (ONE_PLACE.test(type)) return cant(`A ${type} is one place`, 'other-view');
  if (lengthOf(first, 'x') === 1 && lengthOf(first, 'y') === 1 && Object.keys(axes).some(name => name !== 'x' && name !== 'y' && lengthOf(first, name) > 1)) {
    return cant('One cell with steps of its own is one place', 'other-view');
  }
  return readGrid(first, type, paramDefs, topRef);
}

function stepAxes(names: string[], axes: Json) {
  const dims: StepAxis[] = [];
  const fixed: Record<string, unknown> = {};
  for (const name of names) {
    const values = axisValues(axes[name]);
    if (!values) continue;
    if (values.length > 1) dims.push({ name, values });
    else if (values.length === 1) [fixed[name]] = values;
  }
  return { dims, fixed };
}

function readGrid(coverage: Json, type: string, paramDefs: Json, topRef: unknown): CellsReading {
  const domain = coverage.domain as Json;
  const axes = isObj(domain.axes) ? domain.axes : {};
  const xRaw = axisValues(axes.x);
  const yRaw = axisValues(axes.y);
  if (!xRaw || !yRaw) return cant(`The domain has no ${!xRaw ? 'x' : 'y'} axis to draw along: its axes are ${Object.keys(axes).join(', ') || 'missing'}`);
  if (!xRaw.every(isNum) || !yRaw.every(isNum)) return cant(`The ${!xRaw.every(isNum) ? 'x' : 'y'} axis has values that aren't numbers`);
  const xv = xRaw as number[];
  const yv = yRaw as number[];
  if (!runsOneWay(xv) || !runsOneWay(yv)) return cant(`The ${!runsOneWay(xv) ? 'x' : 'y'} axis doesn't run in one direction, so its cells have no edges`);
  const nx = xv.length;
  const ny = yv.length;
  const axisLen: Record<string, number> = {};
  for (const name of Object.keys(axes)) axisLen[name] = axisValues(axes[name])?.length ?? 0;
  const others = Object.keys(axes).filter(name => name !== 'x' && name !== 'y');
  const { dims, fixed } = stepAxes(others, axes);
  const slices = dims.reduce((a, dim) => a * dim.values.length, 1);
  const cells = nx * ny;

  const ascendingX = xv[nx - 1] >= xv[0];
  const northFirst = yv[ny - 1] <= yv[0];
  const colAxis = Int32Array.from({ length: nx }, (_, i) => (ascendingX ? i : nx - 1 - i));
  const rowAxis = Int32Array.from({ length: ny }, (_, i) => (northFirst ? i : ny - 1 - i));
  const xs = Array.from(colAxis, i => xv[i]);
  const ysAscending = Array.from(rowAxis, i => yv[i]).reverse();

  const refs = domain.referencing ?? topRef;
  const crs = crsOf(refs, xv, yv);
  const stepX = nx > 1 ? Math.abs(xs[1] - xs[0]) : null;
  const stepY = ny > 1 ? Math.abs(ysAscending[1] - ysAscending[0]) : null;
  const xBounds = boundsEdges(axes.x, colAxis, nx);
  const yBounds = boundsEdges(axes.y, Array.from(rowAxis).reverse(), ny);
  const xEdges = xBounds ?? edgesOf(xs, stepY ?? 1);
  const yEdgesAscending = yBounds ?? edgesOf(ysAscending, stepX ?? 1);
  const project = crs.geographic ? mercY : (value: number) => value;

  const geometry: GridGeometry = {
    kind: 'grid', nx, ny, cells, xs, ys: ysAscending.slice().reverse(), xEdges,
    yEdges: Float64Array.from(yEdgesAscending, project).reverse(),
    assumedSize: (nx === 1 && !xBounds) || (ny === 1 && !yBounds),
  };

  const parameters: CellParameter[] = [];
  const broken: BrokenParameter[] = [];
  const definitions = { ...paramDefs, ...(isObj(coverage.parameters) ? coverage.parameters : {}) };
  const ranges = isObj(coverage.ranges) ? coverage.ranges : {};
  for (const [id, range] of Object.entries(ranges)) {
    const base = parameterBase(id, definitions[id]);
    const problem = rangeProblem(id, range, axisLen);
    if (problem) {
      broken.push({ ...base, problem });
      continue;
    }
    const theRange = range as Json;
    const order = Object.keys(axes);
    const strides = stridesOf(theRange, order, axisLen);
    if (strides.x === undefined && nx > 1) {
      broken.push({ ...base, problem: `${id}: axisNames has no x, and x has ${count(nx)} values` });
      continue;
    }
    if (strides.y === undefined && ny > 1) {
      broken.push({ ...base, problem: `${id}: axisNames has no y, and y has ${count(ny)} values` });
      continue;
    }
    const strideX = strides.x ?? 0;
    const strideY = strides.y ?? 0;
    const data = new Float32Array(slices * cells);
    const values = theRange.values as unknown[];
    let notNumbers = 0;
    const rowOffsets = Int32Array.from(rowAxis, row => row * strideY);
    const colOffsets = Int32Array.from(colAxis, col => col * strideX);
    const offsets = sliceOffsets(dims, strides);
    for (let slice = 0; slice < slices; slice++) {
      const sliceOffset = offsets[slice];
      let at = slice * cells;
      for (let row = 0; row < ny; row++) {
        const rowOffset = sliceOffset + rowOffsets[row];
        for (let col = 0; col < nx; col++) {
          const value = values[rowOffset + colOffsets[col]];
          if (typeof value === 'number') {
            data[at++] = value;
          } else {
            if (value !== null && value !== undefined) notNumbers++;
            data[at++] = NaN;
          }
        }
      }
    }
    parameters.push({
      ...base,
      data,
      figures: analyse(data, slices, cells),
      notNumbers,
      rawAt(cell, slice) {
        const row = Math.floor(cell / nx);
        const col = cell - row * nx;
        const index = offsets[slice] + rowOffsets[row] + colOffsets[col];
        return { value: values[index], index, pointer: `/ranges/${pointerPart(id)}/values/${index}`, coverage: null };
      },
      indicesAt(cell, slice) {
        const row = Math.floor(cell / nx);
        const col = cell - row * nx;
        const at: Record<string, number> = { y: rowAxis[row], x: colAxis[col], ...stepsOfSlice(dims, slice) };
        const names = Array.isArray(theRange.axisNames) ? (theRange.axisNames as string[]) : Object.keys(at);
        return names.filter(name => at[name] !== undefined || fixed[name] !== undefined).map(name => [name, at[name] ?? 0]);
      },
    });
  }
  if (parameters.length === 0) return cant(broken[0]?.problem ?? 'The coverage has no ranges');
  const notes = gridNotes({ xv, yv, crs, nx: nx === 1 && xBounds ? 2 : nx, ny: ny === 1 && yBounds ? 2 : ny, parameters, broken });
  return {
    drawable: true, source: 'grid', viewLabel: 'Grid', domainType: type || 'Coverage', geometry, dims, fixed, slices, cells, crs,
    parameters, broken, notes, order: { firstX: ascendingX ? 'left' : 'right', firstY: northFirst ? 'top' : 'bottom' },
    zUnit: zUnitOf(refs), coverageCount: null,
  };
}

// ---- Points: FMI's answer to area and cube ------------------------------------------------------

function readPoints(coverages: Json[], type: string, paramDefs: Json, topRef: unknown): CellsReading {
  const axesOf = (coverage: Json) => (coverage.domain as Json).axes as Json;
  const places = new Map<string, number>();
  const xs: number[] = [];
  const ys: number[] = [];
  const times = new Set<unknown>();
  const levels = new Set<unknown>();
  for (const coverage of coverages) {
    const axes = axesOf(coverage);
    const x = axisValues(axes.x)?.[0];
    const y = axisValues(axes.y)?.[0];
    if (!isNum(x) || !isNum(y)) return cant("A point's x or y isn't a number");
    const key = `${x},${y}`;
    if (!places.has(key)) {
      places.set(key, xs.length);
      xs.push(x);
      ys.push(y);
    }
    for (const time of axisValues(axes.t) ?? []) times.add(time);
    for (const level of axisValues(axes.z) ?? []) levels.add(level);
  }
  const n = xs.length;
  const ts = [...times].sort((a, b) => parseTime(a) - parseTime(b));
  const zs = [...levels].sort((a, b) => Number(b) - Number(a));
  const timeIndex = new Map(ts.map((time, i) => [time, i]));
  const levelIndex = new Map(zs.map((level, i) => [level, i]));
  const dims: StepAxis[] = [];
  const fixed: Record<string, unknown> = {};
  if (ts.length > 1) dims.push({ name: 't', values: ts });
  else if (ts.length === 1) [fixed.t] = ts;
  if (zs.length > 1) dims.push({ name: 'z', values: zs });
  else if (zs.length === 1) [fixed.z] = zs;
  const tLength = Math.max(ts.length, 1);
  const zLength = Math.max(zs.length, 1);
  const slices = tLength * zLength;
  const refs = (coverages[0].domain as Json).referencing ?? topRef;
  const crs = crsOf(refs, xs, ys);

  // A complete lattice on lon/lat lines is a Grid sent the long way round
  const distinctX = [...new Set(xs)].sort((a, b) => a - b);
  const distinctY = [...new Set(ys)].sort((a, b) => a - b);
  const product = distinctX.length * distinctY.length;
  const isLattice = distinctX.length > 1 && distinctY.length > 1 && n >= 4 && n / product >= 0.5 && n >= Math.max(distinctX.length, distinctY.length) * 1.5;

  let geometry: GridGeometry | SamplesGeometry;
  let cellOfPlace: number[];
  let cells: number;
  if (isLattice) {
    const column = new Map(distinctX.map((value, i) => [value, i]));
    const rowY = distinctY.slice().reverse();
    const row = new Map(rowY.map((value, i) => [value, i]));
    cells = product;
    cellOfPlace = xs.map((x, i) => row.get(ys[i])! * distinctX.length + column.get(x)!);
    const project = crs.geographic ? mercY : (value: number) => value;
    geometry = {
      kind: 'grid', nx: distinctX.length, ny: distinctY.length, cells, xs: distinctX, ys: rowY,
      xEdges: edgesOf(distinctX, 1),
      yEdges: Float64Array.from(edgesOf(distinctY, 1), project).reverse(),
      assumedSize: false, fromPoints: true,
    };
  } else {
    cells = n;
    cellOfPlace = xs.map((_, i) => i);
    geometry = { kind: 'samples', cells: n, xs: Float64Array.from(xs), ys: Float64Array.from(ys), spacing: spacingOf(xs, ys) };
  }

  // Where each coverage's values land. A place and time can come twice: fmi-obs sends every station in two records,
  // each with the other's nulls, so a number beats a null, per parameter, and the repeats are counted
  const placed = coverages.map(coverage => {
    const axes = axesOf(coverage);
    const x = axisValues(axes.x)![0];
    const y = axisValues(axes.y)![0];
    const cell = cellOfPlace[places.get(`${x},${y}`)!];
    const theirTimes = axisValues(axes.t) ?? [null];
    const theirLevels = axisValues(axes.z) ?? [null];
    const spots: number[] = [];
    for (let t = 0; t < theirTimes.length; t++) {
      for (let z = 0; z < theirLevels.length; z++) {
        const atTime = theirTimes[t] === null ? 0 : timeIndex.get(theirTimes[t])!;
        const atLevel = theirLevels[z] === null ? 0 : levelIndex.get(theirLevels[z])!;
        spots.push((atTime * zLength + atLevel) * cells + cell, t * theirLevels.length + z);
      }
    }
    return spots;
  });
  const taken = new Uint8Array(slices * cells);
  let repeats = 0;
  for (const spots of placed) {
    let again = false;
    for (let i = 0; i < spots.length; i += 2) {
      if (taken[spots[i]]) again = true;
      taken[spots[i]] = 1;
    }
    if (again) repeats++;
  }

  const rangeOf = (coverage: Json, id: string) => {
    const range = isObj(coverage.ranges) ? coverage.ranges[id] : null;
    return isObj(range) && Array.isArray(range.values) ? (range.values as unknown[]) : null;
  };
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const coverage of coverages) {
    for (const id of isObj(coverage.ranges) ? Object.keys(coverage.ranges) : []) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  const parameters: CellParameter[] = [];
  let disagree = 0;
  for (const id of ids) {
    const data = new Float32Array(slices * cells).fill(NaN);
    const owner = new Int32Array(slices * cells).fill(-1);
    const ownerAt = new Int32Array(slices * cells).fill(-1);
    let notNumbers = 0;
    coverages.forEach((coverage, k) => {
      const values = rangeOf(coverage, id);
      if (!values) return;
      const spots = placed[k];
      for (let i = 0; i < spots.length; i += 2) {
        const at = spots[i];
        const index = spots[i + 1];
        const value = values[index];
        if (typeof value === 'number') {
          if (data[at] === data[at]) {
            if (data[at] !== Math.fround(value)) disagree++;
            continue;
          }
          data[at] = value;
          owner[at] = k;
          ownerAt[at] = index;
        } else {
          if (owner[at] < 0) {
            owner[at] = k;
            ownerAt[at] = index;
          }
          if (value !== null && value !== undefined) notNumbers++;
        }
      }
    });
    parameters.push({
      ...parameterBase(id, paramDefs[id]),
      data,
      figures: analyse(data, slices, cells),
      notNumbers,
      rawAt(cell, slice) {
        const k = owner[slice * cells + cell];
        if (k < 0) return { value: undefined, index: null, pointer: null, coverage: null, absent: true };
        const at = ownerAt[slice * cells + cell];
        return { value: rangeOf(coverages[k], id)?.[at], index: at, pointer: `/coverages/${k}/ranges/${pointerPart(id)}/values/${at}`, coverage: k };
      },
      indicesAt(cell, slice) {
        const k = owner[slice * cells + cell];
        return k < 0 ? [] : [['coverage', k]];
      },
    });
  }
  if (parameters.length === 0) return cant('The coverages have no ranges');
  const notes: CellNote[] = [];
  const kind = type || 'Point';
  if (isLattice) {
    const missing = product - n;
    notes.push({ level: 'info', text: `Sent as ${plural(coverages.length, `${kind} coverage`)}, which line up as a ${count(distinctX.length)} × ${count(distinctY.length)} grid${missing ? `, with ${plural(missing, 'position')} missing` : ''}. A Grid domain would say that in a fraction of the size` });
  } else {
    const { spacing } = geometry as SamplesGeometry;
    notes.push({ level: 'info', text: `Sent as ${plural(coverages.length, `${kind} coverage`)}, with ${count(distinctX.length)} different x and ${count(distinctY.length)} different y, so they aren't on lon/lat lines. Each is drawn at its own place${spacing.regular && spacing.km !== null ? `, about ${formatValue(spacing.km)} km apart` : ''}` });
  }
  if (repeats > 0) {
    notes.push({ level: 'warn', text: `${count(repeats)} of the ${count(coverages.length)} coverages repeat${repeats === 1 ? 's' : ''} a place and time another one has. A number is drawn over a null${disagree ? `, and ${plural(disagree, 'pair')} of numbers disagree, where the first is drawn` : ', and no two numbers disagree'}` });
  }
  parameters.forEach(parameter => addParameterNotes(notes, parameter));
  return {
    drawable: true, source: isLattice ? 'points-grid' : 'points', viewLabel: isLattice ? 'Grid' : 'Points', domainType: kind,
    geometry, dims, fixed, slices, cells, crs, parameters, broken: [], notes, order: null, zUnit: zUnitOf(refs), coverageCount: coverages.length,
  };
}

// The median distance to a neighbour, in km, to size a marker. A hash keeps it to about n
function spacingOf(xs: number[], ys: number[]): SamplesGeometry['spacing'] {
  const n = xs.length;
  if (n < 2) return { km: null, regular: false };
  const midLat = ys.reduce((a, b) => a + b, 0) / n;
  const kmX = 111.32 * Math.cos((midLat * Math.PI) / 180);
  const kmY = 111.32;
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const size = Math.max(Math.sqrt(((width * kmX || 1) * (height * kmY || 1)) / n), 1e-6);
  const buckets = new Map<number, number[]>();
  const keyOf = (a: number, b: number) => a * 100003 + b;
  for (let i = 0; i < n; i++) {
    const key = keyOf(Math.floor((xs[i] * kmX) / size), Math.floor((ys[i] * kmY) / size));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }
  const near: number[] = [];
  const stride = Math.max(1, Math.floor(n / 800));
  for (let i = 0; i < n; i += stride) {
    const bucketX = Math.floor((xs[i] * kmX) / size);
    const bucketY = Math.floor((ys[i] * kmY) / size);
    let best = Infinity;
    for (let a = -2; a <= 2; a++) {
      for (let b = -2; b <= 2; b++) {
        for (const j of buckets.get(keyOf(bucketX + a, bucketY + b)) ?? []) {
          if (j === i) continue;
          const distance = Math.hypot((xs[i] - xs[j]) * kmX, (ys[i] - ys[j]) * kmY);
          if (distance < best) best = distance;
        }
      }
    }
    if (best < Infinity) near.push(best);
  }
  near.sort((a, b) => a - b);
  if (!near.length) return { km: null, regular: false };
  const median = near[near.length >> 1];
  const high = near[Math.floor(near.length * 0.9)];
  const low = near[Math.floor(near.length * 0.1)];
  return { km: median, regular: high < median * 1.3 && low > median * 0.7 };
}

// ---- Polygons: DWD's ICON triangles, each cell as it really is -----------------------------------

function readPolygons(coverage: Json, type: string, paramDefs: Json, topRef: unknown): CellsReading {
  const domain = coverage.domain as Json;
  const axes = domain.axes as Json;
  const polygons = (axes.composite as Json).values as number[][][][];
  const n = polygons.length;
  const axisLen: Record<string, number> = { composite: n };
  for (const name of Object.keys(axes)) if (name !== 'composite') axisLen[name] = axisValues(axes[name])?.length ?? 0;
  const others = Object.keys(axes).filter(name => name !== 'composite');
  const { dims, fixed } = stepAxes(others, axes);
  const slices = dims.reduce((a, dim) => a * dim.values.length, 1);
  const offsets = new Uint32Array(n + 1);
  const pts: number[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    for (const [x, y] of polygons[i][0]) {
      pts.push(x, y);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    offsets[i + 1] = pts.length / 2;
  }
  const refs = domain.referencing ?? topRef;
  const crs = crsOf(refs, [minX, maxX], [minY, maxY]);
  const parameters: CellParameter[] = [];
  const broken: BrokenParameter[] = [];
  const definitions = { ...paramDefs, ...(isObj(coverage.parameters) ? coverage.parameters : {}) };
  for (const [id, range] of Object.entries(isObj(coverage.ranges) ? coverage.ranges : {})) {
    const base = parameterBase(id, definitions[id]);
    const problem = rangeProblem(id, range, axisLen);
    if (problem) {
      broken.push({ ...base, problem });
      continue;
    }
    const theRange = range as Json;
    const values = theRange.values as unknown[];
    const strides = stridesOf(theRange, Object.keys(axes), axisLen);
    const stride = strides.composite ?? 1;
    const sliceAt = sliceOffsets(dims, strides);
    const data = new Float32Array(slices * n);
    let notNumbers = 0;
    for (let slice = 0; slice < slices; slice++) {
      for (let i = 0; i < n; i++) {
        const value = values[sliceAt[slice] + i * stride];
        if (typeof value === 'number') {
          data[slice * n + i] = value;
        } else {
          if (value !== null && value !== undefined) notNumbers++;
          data[slice * n + i] = NaN;
        }
      }
    }
    parameters.push({
      ...base,
      data,
      figures: analyse(data, slices, n),
      notNumbers,
      rawAt(cell, slice) {
        const index = sliceAt[slice] + cell * stride;
        return { value: values[index], index, pointer: `/ranges/${pointerPart(id)}/values/${index}`, coverage: null };
      },
      indicesAt(cell, slice) {
        const steps = stepsOfSlice(dims, slice);
        return [...dims.map((dim): [string, number] => [dim.name, steps[dim.name]]), ['composite', cell]];
      },
    });
  }
  if (!parameters.length) return cant(broken[0]?.problem ?? 'The coverage has no ranges');
  const corners = offsets[1] - 1;
  const notes: CellNote[] = [{ level: 'info', text: `Sent as ${plural(n, 'polygon')} on a composite axis${corners === 3 ? ', triangles of the model’s own grid' : ''}. Each is drawn as it is` }];
  parameters.forEach(parameter => addParameterNotes(notes, parameter));
  return {
    drawable: true, source: 'polygons', viewLabel: 'Cells', domainType: type,
    geometry: { kind: 'polygons', cells: n, pts: Float64Array.from(pts), offsets, bbox: [minX, minY, maxX, maxY] },
    dims, fixed, slices, cells: n, crs, parameters, broken, notes, order: null, zUnit: zUnitOf(refs), coverageCount: null,
  };
}

function readMultiPoint(coverage: Json, type: string, paramDefs: Json, topRef: unknown): CellsReading {
  const domain = coverage.domain as Json;
  const axes = domain.axes as Json;
  const composite = axes.composite as Json;
  const tuples = composite.values as number[][];
  const coordinates = composite.coordinates as string[];
  const atX = coordinates.indexOf('x');
  const atY = coordinates.indexOf('y');
  const ranges = isObj(coverage.ranges) ? coverage.ranges : {};
  const asPoints: Json[] = tuples.map((tuple, i) => ({
    domain: {
      axes: { x: { values: [tuple[atX]] }, y: { values: [tuple[atY]] }, ...(axes.t ? { t: axes.t } : {}), ...(axes.z ? { z: axes.z } : {}) },
      referencing: domain.referencing,
    },
    ranges: Object.fromEntries(Object.entries(ranges).map(([id, range]) => [id, { values: isObj(range) && Array.isArray(range.values) ? [range.values[i]] : [] }])),
  }));
  return readPoints(asPoints, type, { ...paramDefs, ...(isObj(coverage.parameters) ? coverage.parameters : {}) }, topRef);
}

// ---- Notes, in the same voice as coverageSummary's --------------------------------------------

// Values that are a code by long habit, here only to word a note
const FILL_LIKE = new Set([-9999, 9999, -999, 999, -99, -32768, 32767, 65535, -999.9, 9999.9]);
const looksLikeFill = (value: number) => Math.abs(value) >= 1e20 || FILL_LIKE.has(Math.round(value * 10) / 10);

function addParameterNotes(notes: CellNote[], parameter: CellParameter) {
  const { id, unit, figures, notNumbers } = parameter;
  if (figures.numbers === 0) {
    notes.push({ level: 'warn', text: notNumbers ? `${id} has no numbers: ${plural(notNumbers, 'value')} aren't numbers` : `All ${plural(figures.total, 'value')} of ${id} are null`, parameter: id });
    return;
  }
  for (const apart of figures.apart) {
    const value = apart.min === apart.max ? formatValue(apart.min) : `${formatValue(apart.min)} to ${formatValue(apart.max)}`;
    const fill = looksLikeFill(apart.min) ? ', which looks like a fill value' : '';
    notes.push({ level: 'warn', text: `${id} has ${plural(apart.count, 'value')} of ${value}${fill}, far from the rest (${formatValue(figures.lo!)} to ${formatValue(figures.hi!)})`, parameter: id });
  }
  const { spike } = figures;
  if (spike && !figures.apart.some(apart => apart.min === spike.value && apart.max === spike.value) && figures.numbers >= 50) {
    const guess = spike.value !== 0 ? '. It may be a code and not a measurement' : '';
    notes.push({ level: guess ? 'warn' : 'info', text: `${formatValue(spike.value)}${unit ? ` ${unit}` : ''} is in ${count(spike.count)} of ${count(figures.total)} ${id} values (${shareText(spike.count / figures.total)}), at the ${spike.atLow ? 'bottom' : 'top'} of the range${guess}`, parameter: id });
  }
  const empty = figures.perSlice.filter(slice => slice.numbers === 0).length;
  if (empty > 0 && empty < figures.perSlice.length) notes.push({ level: 'warn', text: `${plural(empty, 'step')} of ${id} ${empty === 1 ? 'is' : 'are'} all null`, parameter: id });
  addUnitNote(notes, parameter);
}

// Only where a wrong unit can't be read any other way, and only for what's named plainly
function addUnitNote(notes: CellNote[], { id, label, unit, figures }: CellParameter) {
  const name = `${id} ${label ?? ''}`.toLowerCase();
  const symbol = unit.toLowerCase();
  const lo = figures.lo!;
  const hi = figures.hi!;
  const say = (text: string) => notes.push({ level: 'warn', text, parameter: id });
  const values = `its values (${formatValue(lo)} to ${formatValue(hi)})`;
  if (/temperature|(^|[^a-z])t2m|tmp/.test(name)) {
    if (/°?c$|deg_?c|celsius/.test(symbol) && lo > 150) say(`${id} says ${unit}, and ${values} look like kelvin`);
    if (/^k$|kelvin/.test(symbol) && hi < 100) say(`${id} says ${unit}, and ${values} look like °C`);
  }
  if (/pressure|mslp|prmsl/.test(name)) {
    if (/hpa/.test(symbol) && lo > 10000) say(`${id} says ${unit}, and ${values} look like Pa`);
    if (/^pa$/.test(symbol) && hi < 2000) say(`${id} says ${unit}, and ${values} look like hPa`);
  }
  if (/humidity/.test(name) && symbol === '%' && hi <= 1.5) say(`${id} says %, and ${values} look like a fraction`);
}

function gridNotes({ xv, yv, crs, nx, ny, parameters, broken }: {
  xv: number[]; yv: number[]; crs: CellCrs; nx: number; ny: number; parameters: CellParameter[]; broken: BrokenParameter[];
}): CellNote[] {
  const notes: CellNote[] = broken.map(({ problem }) => ({ level: 'error', text: problem }));
  if (!crs.declared) notes.push({ level: 'warn', text: `referencing says nothing about x and y. They're taken as ${crs.geographic ? 'lon/lat, since they fit' : 'plain numbers, since they don’t fit lon/lat'}` });
  if (crs.declared && crs.geographic && !crs.inDegrees) notes.push({ level: 'error', text: 'x or y is beyond what degrees can be, so they may be swapped or not in this CRS' });
  if (crs.geographic) {
    for (const [name, values] of [['x', xv], ['y', yv]] as const) {
      const drift = axisDrift(values);
      // Floating point noise is far below this. A true lon/lat grid has even steps
      if (drift && drift.spread > 0.0005 && drift.strayCells > 0.02) {
        notes.push({ level: 'warn', text: `The ${name} steps aren't even: ${formatValue(drift.min)}° to ${formatValue(drift.max)}°. A lon/lat grid has even steps, so this may be a projected grid labelled lon/lat, where one axis can't place every row. Check a cell with position` });
        break;
      }
    }
  }
  if (nx === 1 || ny === 1) {
    const what = nx === 1 && ny === 1
      ? 'One cell, so the response doesn’t say how big it is. The size drawn'
      : ny === 1 ? 'One row, so the response doesn’t say how tall its cells are. The height drawn' : 'One column, so the response doesn’t say how wide its cells are. The width drawn';
    notes.push({ level: 'info', text: `${what} is only for show` });
  }
  parameters.forEach(parameter => addParameterNotes(notes, parameter));
  return notes;
}
