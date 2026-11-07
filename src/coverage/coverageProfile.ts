import type { ValidationError, Vertical } from '../types/api';
import { coverageParameters, parameterLabel, parameterUnit } from '../utils/coverageTimeSeries';
import { parseTime, utcMoment } from '../utils/utcTime';
import { axisValues, pointerPart } from './coverageCells';
import type { ParameterFigures } from './coverageSummary';
import {
  askedLevels, declaredFits, declaredInterval, declaredLevels, defaultScale, expectedLevels, isNumber, readVerticalAxis, vrsAbout, withUnit,
  type LevelScale, type VerticalAxis,
} from './verticalAxis';

// A coverage as profiles: values at several levels, at one point or a few. Nothing about its shape is taken for
// granted. Every value becomes a cell, keyed by place, time and level, through its range's own axisNames and shape,
// whichever coverage it's in. A profile is whichever cells share a place and a time. So a VerticalProfile, a
// collection of them, FMI's one-value coverages per point and level, and a one-place trajectory all come out the same.

// More places than this can't be told apart as lines: it's a grid, which the grid view takes
export const MOST_LOCATIONS = 8;

export interface ProfileContext {
  url?: string;
  // The open collection's vertical extent, if the request is for it: for the levels that should be there
  vertical?: Vertical;
}

export interface ProfileCell {
  raw: unknown;
  // RFC 6901 pointer to the value in the response
  path: string;
  // Where it is on its coverage's z axis, if it has one
  axisIndex: number | null;
}

export interface ProfileParameter extends ParameterFigures {
  // Per location, per time, per row: as sent, and undefined where nothing was sent
  values: unknown[][][];
  // Its values don't fit its shape and the axes, so none of them are read
  misfit: { count: number; expected: number; path: string } | null;
}

export interface ProfileLocation { x: unknown; y: unknown; label: string }
// at is NaN for a time that isn't one, and raw is null if the response has no time
export interface ProfileTime { raw: string | null; at: number }

export interface CoverageProfile {
  domainType: string;
  coverageCount: number;
  // "2 points, 3 levels, 1 time, 2 parameters"
  shape: string;
  axis: VerticalAxis;
  scale: LevelScale;
  canLog: boolean;
  // Every level sent, ascending
  levels: number[];
  // Those and the levels that should be there and aren't, ascending
  rows: number[];
  missing: number[];
  // Sent, and not among the levels the collection declares
  undeclared: number[];
  // The most levels any one profile has
  mostLevels: number;
  locations: ProfileLocation[];
  // In time order
  times: ProfileTime[];
  parameters: ProfileParameter[];
  cellOf: (parameterId: string, location: number, time: number, row: number) => ProfileCell | null;
  notes: ValidationError[];
}

export type NoProfileReason = 'notCoverage' | 'empty' | 'composite' | 'noZ' | 'zNotNumbers' | 'notIncluded' | 'grid' | 'oneLevel';
export type ProfileResult = { profile: CoverageProfile } | { profile: null; reason: NoProfileReason; message: string };

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const plural = (count: number, noun: string) => `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
const none = (reason: NoProfileReason, message: string): ProfileResult => ({ profile: null, reason, message });
const placeKey = (x: unknown, y: unknown) => `${String(x)},${String(y)}`;
// Like DMI's temperature-850hPa: a level in a parameter's name, which isn't a z axis
const LEVEL_IN_NAME = /(?:^|[-_ ])(\d+(?:\.\d+)?)\s?(hPa|mb|m)\b/i;

interface Coverage { json: Json; axes: Json; composite: Json | null; z: number[] | null }

const tupleValue = (composite: Json, tuple: unknown, name: string) => {
  const coordinates = Array.isArray(composite.coordinates) ? composite.coordinates : [];
  const at = coordinates.indexOf(name);
  return at === -1 || !Array.isArray(tuple) ? undefined : tuple[at];
};
const tuplesOf = (composite: Json): unknown[] => (Array.isArray(composite.values) ? composite.values : []);

export function coverageToProfile(json: unknown, context: ProfileContext = {}): ProfileResult {
  if (!isObject(json) || (json.type !== 'Coverage' && json.type !== 'CoverageCollection')) return none('notCoverage', 'Not a coverage.');
  const isCollection = json.type === 'CoverageCollection';
  const list = isCollection ? json.coverages : [json];
  const prefix = (coverage: number) => (isCollection ? `/coverages/${coverage}` : '');
  const asked = askedLevels(context.url);
  if (!Array.isArray(list) || list.length === 0) {
    return none('empty', `The response has no coverages${asked?.kind === 'list' ? `, for z=${asked.values.join(',')}` : ''}.`);
  }

  // ---- The domains first, which are small: a path, a grid or no z is told without reading a value ----

  const coverages: Coverage[] = [];
  const parameterIds: string[] = [];
  const pathPlaces = new Set<string>();
  let anyZ = false;
  for (const item of list) {
    const coverage = isObject(item) ? item : {};
    const domain = isObject(coverage.domain) ? coverage.domain : {};
    const axes = isObject(domain.axes) ? domain.axes : {};
    const composite = isObject(axes.composite) ? axes.composite : null;
    const z = axisValues(axes.z);
    if (z && !z.every(isNumber)) return none('zNotNumbers', "Its z values aren't numbers.");
    if (z?.length) anyZ = true;
    if (composite) {
      for (const tuple of tuplesOf(composite)) {
        pathPlaces.add(placeKey(tupleValue(composite, tuple, 'x'), tupleValue(composite, tuple, 'y')));
        if (isNumber(tupleValue(composite, tuple, 'z'))) anyZ = true;
      }
    }
    if (isObject(coverage.ranges)) for (const id of Object.keys(coverage.ranges)) if (!parameterIds.includes(id)) parameterIds.push(id);
    coverages.push({ json: coverage, axes, composite, z: z as number[] | null });
  }
  // Tuples that move are a path, which is the section view's. At one place, FMI's answer to a trajectory whose two
  // vertices are the same, they're a profile
  if (pathPlaces.size > 1) return none('composite', `${plural(pathPlaces.size, 'position')} along a path, not one point at many levels.`);
  if (!anyZ) {
    const named = parameterIds.filter(id => LEVEL_IN_NAME.test(id));
    return none('noZ', named.length > 1
      ? `No z axis. ${plural(named.length, 'parameter')} carry a level in the name (${named.slice(0, 2).join(', ')}), which the view doesn't read as levels.`
      : 'No z axis.');
  }

  const places = new Map<string, ProfileLocation>();
  const addPlace = (x: unknown, y: unknown) => {
    const key = placeKey(x, y);
    if (!places.has(key)) places.set(key, { x, y, label: [x, y].filter(v => v !== null && v !== undefined).join(', ') || 'The point' });
    return key;
  };
  for (const { axes, composite } of coverages) {
    if (composite) {
      for (const tuple of tuplesOf(composite)) addPlace(tupleValue(composite, tuple, 'x'), tupleValue(composite, tuple, 'y'));
      continue;
    }
    const x = axisValues(axes.x) ?? [null];
    const y = axisValues(axes.y) ?? [null];
    // A grid's cells are counted without listing them all
    if (x.length * y.length > MOST_LOCATIONS) return none('grid', `${plural(x.length * y.length, 'location')}: a grid, not a profile.`);
    for (const yValue of y) for (const xValue of x) addPlace(xValue, yValue);
  }
  if (places.size > MOST_LOCATIONS) return none('grid', `${plural(places.size, 'location')}: a grid, not a profile.`);

  // ---- Now the values, of a few places: each a cell keyed by place, time, level and parameter ----

  const times = new Map<string, ProfileTime>();
  const levelSet = new Set<number>();
  const perProfile = new Map<string, Set<number>>();
  const cells = new Map<string, ProfileCell>();
  const misfits = new Map<string, { count: number; expected: number; path: string }>();
  const notIncluded = new Set<string>();
  const definitions = new Map<string, unknown>();
  const collectionParameters = isObject(json.parameters) ? json.parameters : undefined;
  let duplicates = 0;
  let outOfOrder: { values: number[]; path: string } | null = null;

  const timeKey = (raw: unknown) => {
    const key = typeof raw === 'string' ? raw : '';
    if (!times.has(key)) times.set(key, { raw: typeof raw === 'string' ? raw : null, at: parseTime(raw) });
    return key;
  };
  // The shape alone: which profile has which level, whatever its values turn out to be
  const level = (place: string, time: string, z: number) => {
    levelSet.add(z);
    const group = `${place}|${time}`;
    if (!perProfile.has(group)) perProfile.set(group, new Set());
    perProfile.get(group)!.add(z);
  };
  const put = (id: string, place: string, time: string, z: number, cell: ProfileCell) => {
    const key = `${place}|${time}|${z}|${id}`;
    if (cells.has(key)) duplicates++;
    else cells.set(key, cell);
  };
  const pathOf = (coverage: number, id: string) => `${prefix(coverage)}/ranges/${pointerPart(id)}/values`;

  for (const [c, { json: coverage, axes, composite, z }] of coverages.entries()) {
    const ranges = isObject(coverage.ranges) ? coverage.ranges : {};
    const own = isObject(coverage.parameters) ? coverage.parameters : undefined;
    const parameters = coverageParameters({ parameters: own }, collectionParameters) ?? {};
    for (const id of Object.keys(ranges)) if (!definitions.has(id)) definitions.set(id, parameters[id]);
    const t = axisValues(axes.t);

    if (composite) {
      // Each tuple is at every level of a z axis, if there is one, else at its own z
      const tuples = tuplesOf(composite).map(tuple => ({
        place: placeKey(tupleValue(composite, tuple, 'x'), tupleValue(composite, tuple, 'y')),
        time: timeKey(tupleValue(composite, tuple, 't') ?? t?.[0]),
        own: tupleValue(composite, tuple, 'z'),
      }));
      for (const tuple of tuples) for (const zValue of z ?? [tuple.own]) if (isNumber(zValue)) level(tuple.place, tuple.time, zValue);
      for (const [id, range] of Object.entries(ranges)) {
        const values = isObject(range) ? range.values : undefined;
        if (!Array.isArray(values)) {
          notIncluded.add(id);
          continue;
        }
        // On a z axis, a value per tuple and level, in the order axisNames gives
        const names = isObject(range) && Array.isArray(range.axisNames) ? range.axisNames : [];
        const levelsEach = z ? z.length : 1;
        const expected = tuples.length * levelsEach;
        if (values.length !== expected || (z !== null && z.length > 1 && !names.includes('z'))) {
          misfits.set(id, { count: values.length, expected, path: pathOf(c, id) });
          continue;
        }
        const zFirst = names.includes('z') && names.indexOf('z') < names.indexOf('composite');
        tuples.forEach((tuple, i) => (z ?? [tuple.own]).forEach((zValue, k) => {
          if (!isNumber(zValue)) return;
          const index = zFirst ? k * tuples.length + i : i * levelsEach + k;
          put(id, tuple.place, tuple.time, zValue, { raw: values[index], path: `${pathOf(c, id)}/${index}`, axisIndex: z ? k : null });
        }));
      }
      continue;
    }

    if (!z) continue;
    const ascending = z.every((v, i) => i === 0 || v > z[i - 1]);
    const descending = z.every((v, i) => i === 0 || v < z[i - 1]);
    if (!ascending && !descending) outOfOrder ??= { values: z, path: `${prefix(c)}/domain/axes/z/values` };

    const x = axisValues(axes.x) ?? [null];
    const y = axisValues(axes.y) ?? [null];
    const tValues = t ?? [null];
    const lengths: Record<string, number> = { x: x.length, y: y.length, z: z.length, t: tValues.length };
    const timeKeys = tValues.map(timeKey);
    for (const yValue of y) for (const xValue of x) for (const time of timeKeys) for (const zValue of z) level(placeKey(xValue, yValue), time, zValue);

    for (const [id, range] of Object.entries(ranges)) {
      const values = isObject(range) ? range.values : undefined;
      if (!Array.isArray(values)) {
        notIncluded.add(id);
        continue;
      }
      // axisNames and shape say what the flat array means. Without them, the axes longer than one, in this order
      const names = (isObject(range) && Array.isArray(range.axisNames) ? range.axisNames : Object.keys(lengths).filter(name => lengths[name] > 1)).map(String);
      const lengthOf = (name: string) => lengths[name] ?? axisValues(axes[name])?.length ?? 1;
      const shape = isObject(range) && Array.isArray(range.shape) ? range.shape.map(Number) : names.map(lengthOf);
      const expected = x.length * y.length * z.length * tValues.length;
      const fits = shape.length === names.length
        && names.every((name, i) => lengthOf(name) === shape[i])
        && Object.keys(lengths).every(name => lengths[name] === 1 || names.includes(name))
        && values.length === expected;
      if (!fits) {
        misfits.set(id, misfits.get(id) ?? { count: values.length, expected, path: pathOf(c, id) });
        continue;
      }
      const strides: Record<string, number> = {};
      let stride = 1;
      for (let i = names.length - 1; i >= 0; i--) {
        strides[names[i]] = stride;
        stride *= shape[i];
      }
      tValues.forEach((_, ti) => z.forEach((zValue, zi) => y.forEach((yValue, yi) => x.forEach((xValue, xi) => {
        const index = (strides.t ?? 0) * ti + (strides.z ?? 0) * zi + (strides.y ?? 0) * yi + (strides.x ?? 0) * xi;
        put(id, placeKey(xValue, yValue), timeKeys[ti], zValue, { raw: values[index], path: `${pathOf(c, id)}/${index}`, axisIndex: zi });
      }))));
    }
  }

  if (cells.size === 0 && notIncluded.size > 0 && misfits.size === 0) return none('notIncluded', "The values aren't in this response.");
  const levels = [...levelSet].sort((a, b) => a - b);
  // The most levels any one profile has: that, and not how many there are in all, makes it a profile
  const mostLevels = Math.max(0, ...[...perProfile.values()].map(group => group.size));
  const axis = readVerticalAxis(json, coverages.find(({ json: coverage }) => isObject(coverage.domain))?.json);
  const levelText = (value: number) => withUnit(value, axis.unit);
  if (mostLevels < 2) {
    return none('oneLevel', levels.length === 1
      ? `One level, ${levelText(levels[0])}: nothing to draw a profile through.`
      : 'One level per point: nothing to draw a profile through.');
  }

  // ---- What should have been there, and the figures ----

  const declared = declaredLevels(context.vertical);
  const missing = expectedLevels(asked, declared, levels).filter(value => !levelSet.has(value));
  const undeclared = declaredFits(declared, levels) ? levels.filter(value => !declared.includes(value)) : [];
  const rows = [...new Set([...levels, ...missing])].sort((a, b) => a - b);
  const placeKeys = [...places.keys()];
  const locations = [...places.values()];
  // Times in order, any that aren't times last
  const timeList = [...times.entries()].map(([key, time]) => ({ key, ...time }))
    .sort((a, b) => (Number.isFinite(a.at) ? (Number.isFinite(b.at) ? a.at - b.at : -1) : Number.isFinite(b.at) ? 1 : 0));

  const parameters: ProfileParameter[] = parameterIds.map(id => {
    const definition = definitions.get(id) as Parameters<typeof parameterLabel>[1] & Parameters<typeof parameterUnit>[0];
    const label = parameterLabel(id, definition);
    const values = placeKeys.map(place => timeList.map(time => rows.map(row => cells.get(`${place}|${time.key}|${row}|${id}`)?.raw)));
    let count = 0;
    let nulls = 0;
    let numbers = 0;
    let others = 0;
    let sum = 0;
    let min: number | null = null;
    let max: number | null = null;
    for (const byTime of values) for (const byRow of byTime) for (const value of byRow) {
      if (value === undefined) continue;
      count++;
      if (value === null) nulls++;
      else if (isNumber(value)) {
        numbers++;
        sum += value;
        if (min === null || value < min) min = value;
        if (max === null || value > max) max = value;
      } else others++;
    }
    return {
      id, label: label === id ? null : label, unit: parameterUnit(definition),
      count, nulls, others, numbers, min, max, mean: numbers ? sum / numbers : null,
      notIncluded: notIncluded.has(id), values, misfit: misfits.get(id) ?? null,
    };
  });

  const cellOf = (parameterId: string, location: number, time: number, row: number) => {
    const place = placeKeys[location];
    const when = timeList[time];
    return place === undefined || when === undefined ? null : (cells.get(`${place}|${when.key}|${rows[row]}|${parameterId}`) ?? null);
  };

  // ---- Findings for Checks ----

  // A note is what's there to see. An issue is the server's to fix: its metadata and its data disagree, or it leaves
  // out what a client needs. An error breaks CoverageJSON. A pass is what was checked and found right. Kept apart, for
  // an audit of the service
  const notes: ValidationError[] = [];
  const note = (message: string, path: string, severity: ValidationError['severity'] = 'info') => notes.push({ message, path, severity });
  const issue = (message: string, path: string) => note(message, path, 'warning');
  const pass = (message: string, path: string) => note(message, path, 'pass');
  // Against the collection's metadata. With a path where it's the response that's off, and none where it's about the
  // collection alone
  const against = (severity: 'warning' | 'pass', message: string, path?: string) => notes.push({ message, ...(path ? { path } : {}), severity, source: 'collection' });
  const zPath = `${prefix(0)}/domain/axes/z`;
  const listed = (values: number[]) => `${values.slice(0, 5).join(', ')}${values.length > 5 ? ` and ${values.length - 5} more` : ''}`;
  const one = (count: number, singular: string, plural: string) => (count === 1 ? singular : plural);

  // What z is: the response's own words, then the collection's vrs against them. The vrs is only checked against,
  // and only where it's about these levels
  const vrs = vrsAbout(context.vertical, levels);
  if (axis.directionSource === 'response') pass(`z's direction is in the response: ${axis.direction}`, zPath);
  else if (axis.directionSource === 'usual') issue(`z's direction isn't in the response: assumed ${axis.direction}, as usual for ${axis.usualWords}`, zPath);
  else issue("z's direction isn't in the response, and nothing says what z is: assumed up", zPath);
  if (vrs?.direction && vrs.direction !== axis.direction) {
    against('warning', axis.directionSource === 'response'
      ? `The response says z runs ${axis.direction}, and the collection's vrs says ${vrs.direction}`
      : `The collection's vrs says z runs ${vrs.direction}, and ${axis.direction} is assumed for the response`, zPath);
  } else if (vrs?.direction) against('pass', `The collection's vrs gives z's direction: ${vrs.direction}`);
  if (axis.againstUsual) issue(`z is ${axis.usualWords} and says it runs ${axis.direction}, against the usual`, zPath);
  if (axis.flatCrs) {
    const first = coverages[0].json;
    const referencing = isObject(first.domain) && Array.isArray(first.domain.referencing) ? `${prefix(0)}/domain/referencing` : '/referencing';
    issue(`z is referenced to ${axis.flatCrs}, which has no vertical axis`, referencing);
  }

  // A level number needs no unit
  if (axis.unitSource === 'response' && axis.unit) pass(`z's unit is in the response: ${axis.unit}`, zPath);
  else if (axis.unitSource === 'description') issue(`z's unit, ${axis.unit}, is only in a description, and not in its reference system's axis`, zPath);
  else if (axis.unitSource === 'none' && axis.kind !== 'modelLevel') issue('z has no unit in the response', zPath);
  if (vrs?.unit && axis.unit && vrs.unit !== axis.unit) against('warning', `z's unit is ${axis.unit} in the response, and ${vrs.unit} in the collection's vrs`, zPath);
  else if (vrs?.unit) against('pass', `The collection's vrs gives z's unit: ${vrs.unit}`);

  // The levels: what was asked for, what the collection has, and what it says its extent is
  // Asked for is the request's, and declared is the collection's
  const zValues = `${zPath}/values`;
  if (missing.length && asked?.kind === 'list') {
    issue(`z=${listed(missing)} ${one(missing.length, 'was', 'were')} asked for, and ${one(missing.length, "isn't", "aren't")} in the response`, zValues);
  } else if (missing.length) {
    against('warning', `${one(missing.length, 'Level', 'Levels')} ${listed(missing)}${axis.unit ? ` ${axis.unit}` : ''} ${one(missing.length, 'is', 'are')} in the collection's extent, and ${one(missing.length, "isn't", "aren't")} in the response`, zValues);
  } else if (asked?.kind === 'list' && asked.values.some(value => levelSet.has(value))) {
    pass(`Every level asked for is in the response: ${listed(asked.values)}`, zValues);
  } else if (!asked && declaredFits(declared, levels)) {
    against('pass', "Every level in the collection's extent is in the response", zValues);
  }
  if (undeclared.length) against('warning', `z ${listed(undeclared)} ${one(undeclared.length, "isn't", "aren't")} among the levels in the collection's extent`, zValues);
  else if (declaredFits(declared, levels)) against('pass', "Every level in the response is among those in the collection's extent", zValues);
  const interval = declaredInterval(context.vertical);
  const outside = interval ? levels.filter(value => value < interval[0] || value > interval[1]) : [];
  if (interval && outside.length) against('warning', `z ${listed(outside)} ${one(outside.length, 'is', 'are')} outside the collection's extent, ${interval[0]} to ${interval[1]}`, zValues);
  else if (interval) against('pass', `Every level is inside the collection's extent, ${interval[0]} to ${interval[1]}`, zValues);
  if (outOfOrder) note(`Levels aren't in order: ${outOfOrder.values.join(', ')}`, outOfOrder.path);
  if (mostLevels !== levels.length) note(`The levels change from time to time: ${levels.length} in all, at most ${mostLevels} at a time`, `${zPath}/values`);
  if (duplicates) issue(`${plural(duplicates, 'value')} sent again for a level already sent. The first is used`, `${prefix(0)}/ranges`);

  // The values. A parameter can lack levels the others have: a server may drop a level it has no value for, where a
  // null would say so
  for (const parameter of parameters) {
    const lacking = parameter.misfit || parameter.notIncluded ? [] : levels.filter(level => {
      const row = rows.indexOf(level);
      return parameter.values.every(byTime => byTime.every(byRow => byRow[row] === undefined));
    });
    const askedLacking = asked?.kind === 'list' ? lacking.filter(level => asked.values.includes(level)) : [];
    if (askedLacking.length) {
      issue(`${parameter.id} isn't at z=${listed(askedLacking)}, which ${one(askedLacking.length, 'was', 'were')} asked for`, `${zValues}`);
    } else if (lacking.length) {
      note(`${parameter.id} has ${levels.length - lacking.length} of the ${levels.length} levels: not ${listed(lacking)}`, `${zValues}`);
    }
    if (parameter.misfit) {
      note(`${parameter.id}: shape and axes make ${plural(parameter.misfit.expected, 'value')}, and values has ${parameter.misfit.count.toLocaleString('en-US')}, so none are read`, parameter.misfit.path, 'error');
    }
    const first = parameter.nulls > 0 ? firstNull(parameter.values) : null;
    const at = first && cellOf(parameter.id, first.location, first.time, first.row);
    if (!first || !at) continue;
    if (parameter.nulls === parameter.count) {
      note(`All ${plural(parameter.count, 'value')} of ${parameter.id} are null`, at.path);
      continue;
    }
    const time = timeList[first.time];
    const when = timeList.length > 1 && Number.isFinite(time.at) ? `, ${utcMoment(time.at)}` : '';
    const where = locations.length > 1 ? ` (${locations[first.location].label})` : '';
    note(`${plural(parameter.nulls, 'null')} in ${parameter.id}, ${parameter.nulls === 1 ? 'at' : 'first at'} ${levelText(rows[first.row])}${when}${where}`, at.path);
  }
  const fitting = parameters.filter(parameter => !parameter.misfit && !parameter.notIncluded).length;
  if (fitting > 0 && fitting === parameters.length) pass(`Every parameter's values fit its shape and axes`, `${prefix(0)}/ranges`);

  const domainTypes = new Set(coverages.map(({ json: coverage }) => (isObject(coverage.domain) ? coverage.domain.domainType : undefined) ?? json.domainType));
  const [onlyType] = domainTypes;
  const levelWords = mostLevels === levels.length ? plural(levels.length, 'level') : `${levels.length} levels in all, ${mostLevels} at a time`;
  const timeWords = timeList.length === 1 && timeList[0].raw === null ? [] : [plural(timeList.length, 'time')];
  return {
    profile: {
      domainType: domainTypes.size > 1 ? 'Mixed' : typeof onlyType === 'string' && onlyType ? onlyType : 'Coverage',
      coverageCount: coverages.length,
      shape: [plural(locations.length, 'point'), levelWords, ...timeWords, plural(parameters.length, 'parameter')].join(', '),
      axis,
      ...defaultScale(axis.kind, levels),
      levels, rows, missing, undeclared, mostLevels,
      locations,
      times: timeList.map(({ raw, at }) => ({ raw, at })),
      parameters,
      cellOf,
      notes,
    },
  };
}

function firstNull(values: unknown[][][]): { location: number; time: number; row: number } | null {
  for (let location = 0; location < values.length; location++) {
    for (let time = 0; time < values[location].length; time++) {
      const row = values[location][time].indexOf(null);
      if (row !== -1) return { location, time, row };
    }
  }
  return null;
}
