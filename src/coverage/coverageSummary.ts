import type { ValidationError } from '../types/api';
import { axisLength, coverageParameters, isTimeSeriesCoverage, parameterLabel, parameterUnit } from '../utils/coverageTimeSeries';
import { parseTime, utcMoment } from '../utils/utcTime';
import { coverageToProfile, type CoverageProfile, type ProfileContext } from './coverageProfile';

// What a CoverageJSON response holds, worked out once for all the ways of showing it: its shape in
// a sentence, each parameter's figures, its time series if it has them, and what's worth a note.
// It's the API's own data, so nothing about its shape is taken for granted.

export interface ParameterFigures {
  id: string;
  // A name to read, if it says more than the id
  label: string | null;
  unit: string;
  count: number;
  nulls: number;
  // Values that are neither numbers nor null, such as text
  others: number;
  numbers: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  // The range isn't an array of values here: a link, or tiles
  notIncluded: boolean;
}

export interface ChartedParameter extends ParameterFigures {
  // Per location, per time: as the API sent them, and just the numbers
  raw: unknown[][];
  series: (number | null)[][];
}

export interface StepChange {
  at: number;
  // The new step, like "3 h"
  label: string;
}

export interface CoverageSeries {
  // In order, without repeats, over all locations
  times: number[];
  rawTimes: string[];
  locations: string[];
  parameters: ChartedParameter[];
  stepChanges: StepChange[];
}

export interface CoverageSummary {
  domainType: string;
  // "1 point, 93 times, 4 parameters"
  shape: string;
  // "Hourly to Nov 8 06:00, then 3-hourly."
  timeText: string | null;
  // "x 20.03125 to 30.96875", for what isn't a point
  axes: string[];
  parameters: ParameterFigures[];
  // If it's time series at one or more locations
  series: CoverageSeries | null;
  // If it has values at several levels, at a point or a few
  profile: CoverageProfile | null;
  notes: ValidationError[];
}

type Json = Record<string, unknown>;
interface Axis { values?: unknown[]; start?: unknown; stop?: unknown; num?: unknown }

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const axesOf = (coverage: Json): Record<string, Axis> => {
  const axes = isObject(coverage.domain) ? coverage.domain.axes : undefined;
  return isObject(axes) ? (axes as Record<string, Axis>) : {};
};
const plural = (count: number, noun: string) => `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
// RFC 6901: a parameter's id can hold anything
const pointerPart = (text: string) => text.replace(/~/g, '~0').replace(/\//g, '~1');

// A figure as it's shown: all a value's digits are in the table and the raw text
export const formatValue = (value: number) => String(Number(value.toPrecision(6)));

const HOUR = 3600000;
const DAY = 24 * HOUR;

// A step as a reader says it: "hourly", "3-hourly", "every 15 min"
function stepName(step: number): string {
  if (step === DAY) return 'daily';
  if (step % DAY === 0) return `every ${step / DAY} days`;
  if (step === HOUR) return 'hourly';
  if (step % HOUR === 0) return `${step / HOUR}-hourly`;
  if (step === 60000) return 'every minute';
  if (step % 60000 === 0) return `every ${step / 60000} min`;
  return `every ${step / 1000} s`;
}

// And short, beside others: "3 h", "15 min"
function stepLabel(step: number): string {
  if (step % DAY === 0) return `${step / DAY} d`;
  if (step % HOUR === 0) return `${step / HOUR} h`;
  if (step % 60000 === 0) return `${step / 60000} min`;
  return `${step / 1000} s`;
}

interface StepRun { step: number; from: number; to: number }

// Stretches of the same time step
export function stepRuns(times: number[]): StepRun[] {
  const runs: StepRun[] = [];
  for (let i = 1; i < times.length; i++) {
    const step = times[i] - times[i - 1];
    const run = runs[runs.length - 1];
    if (run?.step === step) run.to = times[i];
    else runs.push({ step, from: times[i - 1], to: times[i] });
  }
  return runs;
}

// Past this it says less to name each one
const MOST_RUNS_NAMED = 3;
const capitalised = (text: string) => text[0].toUpperCase() + text.slice(1);

export function describeTimes(times: number[]): string | null {
  if (times.length === 0) return null;
  const first = utcMoment(times[0]);
  if (times.length === 1) return `At ${first}.`;
  const last = utcMoment(times[times.length - 1]);
  const runs = stepRuns(times);
  if (runs.length === 1) return `${capitalised(stepName(runs[0].step))}, ${first} to ${last}.`;
  if (runs.length > MOST_RUNS_NAMED) return `Irregular steps, ${first} to ${last}.`;
  const named = runs.map((run, index) => (index === runs.length - 1 ? stepName(run.step) : `${stepName(run.step)} to ${utcMoment(run.to)}`));
  return `${capitalised(named.join(', then '))}.`;
}

// The distance between an axis's values, if it's the same all along
function axisStep(axis: Axis | undefined): number | null {
  if (!axis) return null;
  if (typeof axis.start === 'number' && typeof axis.stop === 'number' && typeof axis.num === 'number') {
    return axis.num > 1 ? Number((Math.abs(axis.stop - axis.start) / (axis.num - 1)).toPrecision(10)) : null;
  }
  const { values } = axis;
  if (!Array.isArray(values) || values.length < 2 || !values.every(value => typeof value === 'number')) return null;
  const numbers = values as number[];
  const step = Math.abs(numbers[1] - numbers[0]);
  const even = numbers.every((value, i) => i === 0 || Math.abs(Math.abs(value - numbers[i - 1]) - step) <= step * 1e-6);
  return even && step > 0 ? Number(step.toPrecision(10)) : null;
}

// Where an axis runs, if its values are numbers
function axisSpan(name: string, axis: Axis | undefined): string | null {
  if (!axis) return null;
  if (typeof axis.start === 'number' && typeof axis.stop === 'number') return `${name} ${axis.start} to ${axis.stop}`;
  const { values } = axis;
  if (!Array.isArray(values) || values.length === 0 || !values.every(value => typeof value === 'number')) return null;
  const numbers = values as number[];
  const min = numbers.reduce((a, b) => Math.min(a, b));
  const max = numbers.reduce((a, b) => Math.max(a, b));
  return min === max ? `${name} ${min}` : `${name} ${numbers[0]} to ${numbers[numbers.length - 1]}`;
}

function isInDegrees(coverage: Json): boolean {
  const referencing = isObject(coverage.domain) ? coverage.domain.referencing : undefined;
  if (!Array.isArray(referencing)) return false;
  return referencing.some(entry => {
    const system = isObject(entry) ? entry.system : undefined;
    if (!isObject(system)) return false;
    return system.type === 'GeographicCRS' || (typeof system.id === 'string' && /CRS84|4326/.test(system.id));
  });
}

// "176 × 64 cells, every 0.0625°", then what else it runs along
function describeAxes(coverage: Json): string[] {
  const axes = axesOf(coverage);
  const length = (name: string) => axisLength(axes[name] as Parameters<typeof axisLength>[0]);
  const x = length('x');
  const y = length('y');
  const parts: string[] = [];
  if (x !== undefined && y !== undefined && x > 1 && y > 1) {
    const stepX = axisStep(axes.x);
    const stepY = axisStep(axes.y);
    const unit = isInDegrees(coverage) ? '°' : '';
    const steps = stepX === null || stepY === null ? '' : stepX === stepY ? `, every ${stepX}${unit}` : `, every ${stepX}${unit} × ${stepY}${unit}`;
    parts.push(`${x.toLocaleString('en-US')} × ${y.toLocaleString('en-US')} cells${steps}`);
  } else if ((x ?? 1) > 1 || (y ?? 1) > 1) {
    parts.push(plural(Math.max(x ?? 1, y ?? 1), 'position'));
  } else if (x !== undefined || y !== undefined) {
    parts.push('1 point');
  }
  const composite = length('composite');
  if (composite !== undefined) parts.push(plural(composite, 'position'));
  const z = length('z');
  if (z !== undefined && z > 1) parts.push(plural(z, 'level'));
  const t = length('t');
  if (t !== undefined) parts.push(plural(t, 'time'));
  return parts;
}

function domainTypeOf(coverages: Json[], json: Json): string {
  const types = new Set(coverages.map(coverage => (isObject(coverage.domain) ? coverage.domain.domainType : undefined) ?? json.domainType));
  if (types.size > 1) return 'Mixed';
  const [type] = types;
  return typeof type === 'string' && type ? type : 'Coverage';
}

function locationName(coverage: Json, index: number): string {
  const axes = axesOf(coverage);
  const place = ['x', 'y', 'z'].flatMap(name => {
    const value = axes[name]?.values?.[0];
    return typeof value === 'number' ? [value] : [];
  });
  return place.length >= 2 ? place.join(', ') : `Location ${index + 1}`;
}

interface Tally extends ParameterFigures {
  sum: number;
  firstNull: { coverage: number; index: number } | null;
}

function tallyParameters(coverages: Json[], json: Json): Map<string, Tally> {
  const collectionParameters = isObject(json.parameters) ? (json.parameters as Record<string, Parameters<typeof parameterLabel>[1] & Parameters<typeof parameterUnit>[0]>) : undefined;
  const tallies = new Map<string, Tally>();
  coverages.forEach((coverage, coverageIndex) => {
    if (!isObject(coverage.ranges)) return;
    const own = isObject(coverage.parameters) ? (coverage.parameters as typeof collectionParameters) : undefined;
    const parameters = coverageParameters({ parameters: own }, collectionParameters);
    for (const [id, range] of Object.entries(coverage.ranges)) {
      let tally = tallies.get(id);
      if (!tally) {
        const parameter = parameters?.[id];
        const label = parameterLabel(id, parameter);
        tally = {
          id, label: label === id ? null : label, unit: parameterUnit(parameter),
          count: 0, nulls: 0, others: 0, numbers: 0, min: null, max: null, mean: null, sum: 0, firstNull: null, notIncluded: false,
        };
        tallies.set(id, tally);
      }
      const values = isObject(range) ? range.values : undefined;
      if (!Array.isArray(values)) {
        tally.notIncluded = true;
        continue;
      }
      tally.count += values.length;
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value === null) {
          tally.nulls++;
          tally.firstNull ??= { coverage: coverageIndex, index: i };
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          tally.numbers++;
          tally.sum += value;
          if (tally.min === null || value < tally.min) tally.min = value;
          if (tally.max === null || value > tally.max) tally.max = value;
        } else {
          tally.others++;
        }
      }
    }
  });
  for (const tally of tallies.values()) tally.mean = tally.numbers > 0 ? tally.sum / tally.numbers : null;
  return tallies;
}

function timesOf(coverage: Json): { raw: string[]; parsed: number[] } | null {
  const values = axesOf(coverage).t?.values;
  if (!Array.isArray(values)) return null;
  const parsed = values.map(parseTime);
  return parsed.every(Number.isFinite) ? { raw: values as string[], parsed } : null;
}

const toFigures = ({ sum: _sum, firstNull: _firstNull, ...figures }: Tally): ParameterFigures => figures;

interface Seen { raw: string; coverage: number; index: number }

function buildSeries(coverages: Json[], tallies: Map<string, Tally>): { series: CoverageSeries; seen: Map<number, Seen>; coverageTimes: number[][] } | null {
  if (coverages.length === 0 || !coverages.every(isTimeSeriesCoverage)) return null;
  const axes = coverages.map(timesOf);
  if (axes.some(axis => axis === null)) return null;

  const seen = new Map<number, Seen>();
  axes.forEach((axis, coverage) => axis!.parsed.forEach((time, index) => {
    if (!seen.has(time)) seen.set(time, { raw: axis!.raw[index], coverage, index });
  }));
  const times = [...seen.keys()].sort((a, b) => a - b);
  const position = new Map(times.map((time, index) => [time, index]));

  const parameters = [...tallies.values()].map((tally): ChartedParameter => {
    const raw = coverages.map((coverage, coverageIndex) => {
      const line: unknown[] = new Array(times.length).fill(null);
      const range = isObject(coverage.ranges) ? coverage.ranges[tally.id] : undefined;
      const values = isObject(range) ? range.values : undefined;
      if (Array.isArray(values)) {
        axes[coverageIndex]!.parsed.forEach((time, index) => {
          line[position.get(time)!] = values[index] ?? null;
        });
      }
      return line;
    });
    const series = raw.map(line => line.map(value => (typeof value === 'number' && Number.isFinite(value) ? value : null)));
    return { ...toFigures(tally), raw, series };
  });

  const runs = stepRuns(times);
  return {
    seen,
    coverageTimes: axes.map(axis => axis!.parsed),
    series: {
      times,
      rawTimes: times.map(time => seen.get(time)!.raw),
      locations: coverages.map(locationName),
      parameters,
      stepChanges: runs.length > MOST_RUNS_NAMED ? [] : runs.slice(1).map(run => ({ at: run.from, label: stepLabel(run.step) })),
    },
  };
}

// The request's URL and the open collection's vertical extent tell a profile which levels should be there
export function summarizeCoverage(json: unknown, context: ProfileContext = {}): CoverageSummary | null {
  if (!isObject(json)) return null;
  const isCollection = json.type === 'CoverageCollection' && Array.isArray(json.coverages);
  if (json.type !== 'Coverage' && !isCollection) return null;

  const coverages = (isCollection ? (json.coverages as unknown[]) : [json]).map(coverage => (isObject(coverage) ? coverage : {}));
  // Levels at a point read as a profile. Its notes for nulls name the level. Of a collection it says the shape better
  // too: 2 points at 3 levels, not 6 points, and 1 point over 85 times, not 85 coverages. One coverage's axes say it
  // already, a grid's cells better than points would
  const { profile } = coverageToProfile(json, context);
  const profileShape = profile && coverages.length > 1 ? profile.shape : null;
  const prefix = (coverage: number) => (isCollection ? `/coverages/${coverage}` : '');
  const tallies = tallyParameters(coverages, json);
  const built = buildSeries(coverages, tallies);
  const parameterCount = plural(tallies.size, 'parameter');

  const notes: ValidationError[] = [];
  const note = (message: string, path: string) => notes.push({ message, path, severity: 'info' });

  if (profile) notes.push(...profile.notes);
  for (const { id, nulls, count, firstNull } of tallies.values()) {
    if (!firstNull || profile) continue;
    const path = `${prefix(firstNull.coverage)}/ranges/${pointerPart(id)}/values/${firstNull.index}`;
    if (nulls === count) {
      note(`All ${plural(count, 'value')} of ${id} are null`, path);
      continue;
    }
    const time = built?.coverageTimes[firstNull.coverage]?.[firstNull.index];
    const where = time === undefined ? '' : `${nulls === 1 ? ', at ' : ', first at '}${utcMoment(time)}`;
    const place = built && built.series.locations.length > 1 ? ` (${built.series.locations[firstNull.coverage]})` : '';
    note(`${plural(nulls, 'null')} in ${id}${where}${where ? place : ''}`, path);
  }

  if (built) {
    const { times, locations } = built.series;
    const runs = stepRuns(times);
    const pathTo = (time: number) => {
      const { coverage, index } = built.seen.get(time)!;
      return `${prefix(coverage)}/domain/axes/t/values/${index}`;
    };
    if (runs.length > MOST_RUNS_NAMED) {
      note(`Time step changes ${runs.length - 1} times, first at ${utcMoment(runs[1].from)}`, pathTo(runs[1].from));
    } else {
      runs.slice(1).forEach((run, index) => {
        note(`Time step changes from ${stepLabel(runs[index].step)} to ${stepLabel(run.step)} at ${utcMoment(run.from)}`, pathTo(run.from));
      });
    }
    const placeWord = /polygon/i.test(domainTypeOf(coverages, json)) ? 'polygon' : 'point';
    return {
      domainType: domainTypeOf(coverages, json),
      shape: profileShape ?? `${plural(locations.length, placeWord)}, ${plural(times.length, 'time')}, ${parameterCount}`,
      timeText: describeTimes(times),
      axes: [],
      parameters: built.series.parameters,
      series: built.series,
      profile,
      notes,
    };
  }

  // Not a time series: there's one shape to describe only if there's one coverage
  const [only] = coverages;
  const one = coverages.length === 1 ? only : null;
  const time = one ? timesOf(one) : null;
  const profileTimes = profileShape && profile ? profile.times.map(({ at }) => at).filter(Number.isFinite) : null;
  return {
    domainType: domainTypeOf(coverages, json),
    shape: profileShape ?? [...(one ? describeAxes(one) : [plural(coverages.length, 'coverage')]), parameterCount].join(', '),
    timeText: profileTimes ? describeTimes(profileTimes) : time ? describeTimes([...new Set(time.parsed)].sort((a, b) => a - b)) : null,
    axes: one ? ['x', 'y', 'z'].flatMap(name => axisSpan(name, axesOf(one)[name]) ?? []) : [],
    parameters: [...tallies.values()].map(toFigures),
    series: null,
    profile,
    notes,
  };
}

// The words beside a parameter
export function rangeText({ min, max, unit }: ParameterFigures): string | null {
  if (min === null || max === null) return null;
  const end = unit ? ` ${unit}` : '';
  return min === max ? `${formatValue(min)}${end}` : `${formatValue(min)} to ${formatValue(max)}${end}`;
}

export function meanText({ mean, min, max }: ParameterFigures): string | null {
  return mean === null || min === max ? null : `mean ${formatValue(mean)}`;
}

export function countText({ count, nulls, others, notIncluded }: ParameterFigures): string {
  if (notIncluded && count === 0) return "Values aren't in this response";
  const base = `${plural(count, 'value')}, ${nulls.toLocaleString('en-US')} null`;
  return others > 0 ? `${base}, ${others.toLocaleString('en-US')} not a number` : base;
}
