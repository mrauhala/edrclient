import type { Collection } from '../types/api';
import { normalizeTemporal, getOverallTemporalExtent, expandTemporalValues } from '../utils/extents/temporal';
import { normalizeVertical, expandVerticalValues } from '../utils/extents/vertical';
import { normalizeBbox } from '../utils/extents/bbox';
import { effectiveOutputFormats, parameterIdsOf, unitsFor } from './queryTypes';
import type { QueryModel } from './queryModel';
import type { DimSelection, IssueSeverity, IssueSource, QueryIssue } from './types';
import { SEVERITY_ORDER } from './types';
import type { ApiDocsCheck } from '../validation/openapi/checkQueryUrl';

// ── Collection extents, computed once per collection (validation runs on every slider tick) ──

interface Range {
  min: number;
  max: number;
}
interface Extents {
  time: Range | null;
  levels: { values: number[]; range: Range | null } | null;
  bbox: [number, number, number, number] | null; // lon/lat, axes sorted
}

const extentsCache = new WeakMap<Collection, Extents>();

const toTime = (value: string | null | undefined, open: number) => {
  if (!value || value === '..') return open;
  const time = Date.parse(value);
  return isNaN(time) ? open : time;
};

function rangeOf(values: number[]): Range | null {
  return values.length > 0 ? { min: Math.min(...values), max: Math.max(...values) } : null;
}

function extentsOf(collection: Collection): Extents {
  const cached = extentsCache.get(collection);
  if (cached) return cached;
  const extent = collection.extent;

  let time: Range | null = null;
  if (extent?.temporal) {
    const temporal = normalizeTemporal(extent.temporal);
    const overall = temporal ? getOverallTemporalExtent(temporal.intervals) : null;
    time = overall
      ? { min: toTime(overall[0], -Infinity), max: toTime(overall[1], Infinity) }
      : rangeOf(expandTemporalValues(extent.temporal).map(value => Date.parse(value)).filter(t => !isNaN(t)));
  }

  let levels: Extents['levels'] = null;
  if (extent?.vertical) {
    const vertical = normalizeVertical(extent.vertical);
    const values = expandVerticalValues(extent.vertical).map(Number).filter(isFinite);
    // Ends may come in either order: pressure levels run high to low (FMI: [1000, 50])
    const bounds = vertical?.intervals.map(([a, b]) => (a !== null && b !== null
      ? { min: Math.min(a, b), max: Math.max(a, b) }
      : { min: a ?? -Infinity, max: b ?? Infinity })) ?? [];
    levels = {
      values: extent.vertical.values?.length ? values : [],
      range: bounds.length > 0
        ? { min: Math.min(...bounds.map(b => b.min)), max: Math.max(...bounds.map(b => b.max)) }
        : rangeOf(values),
    };
  }

  let bbox: Extents['bbox'] = null;
  const spatial = extent?.spatial;
  if (spatial?.bbox && (!spatial.crs || /CRS84|4326/i.test(spatial.crs))) {
    const boxes = normalizeBbox(spatial.bbox);
    if (boxes && boxes.length > 0) {
      const [x1, y1, x2, y2] = boxes[0];
      bbox = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    }
  }

  const result = { time, levels, bbox };
  extentsCache.set(collection, result);
  return result;
}

// ── Checks ──

type Add = (severity: IssueSeverity, source: IssueSource, field: string, rule: string, message: string, input?: QueryIssue['input']) => void;

const inBbox = ([lon, lat]: [number, number], [west, south, east, north]: [number, number, number, number]) =>
  lon >= west && lon <= east && lat >= south && lat <= north;

function checkGeometry(model: QueryModel, add: Add) {
  const { queryType, points, polygons } = model;
  const bbox = extentsOf(model.collection).bbox;

  switch (queryType) {
    case 'position':
    case 'radius':
      if (points.length === 0) add('missing', 'edr', 'coords', 'required', 'Click a point on the map', 'map');
      if (bbox) {
        points.forEach((point, i) => {
          if (!inBbox(point, bbox)) {
            add('warning', 'metadata', 'coords', `outside-${i}`, `Point ${i + 1} is outside the collection's spatial extent`, 'map');
          }
        });
      }
      break;
    case 'trajectory':
      if (points.length < 2) add('missing', 'edr', 'coords', 'required', 'Draw the trajectory on the map (at least 2 points)', 'map');
      break;
    case 'area':
      if (polygons.length === 0) add('missing', 'edr', 'coords', 'required', 'Draw an area on the map', 'map');
      polygons.forEach((polygon, i) => {
        const corners = new Set(polygon.map(([lon, lat]) => `${lon},${lat}`)).size;
        if (corners < 3) add('error', 'edr', 'coords', `corners-${i}`, `Area ${i + 1} needs at least 3 corners`, 'map');
        if (bbox && polygon.length > 0 && !polygon.some(point => inBbox(point, bbox))) {
          add('warning', 'metadata', 'coords', `outside-${i}`, `Area ${i + 1} is outside the collection's spatial extent`, 'map');
        }
      });
      break;
    case 'cube':
      add('warning', 'edr', 'bbox', 'unsupported',
        "Cube queries need a bounding box (bbox), which the query builder can't set yet. The request is sent without it.");
      break;
    case 'corridor':
      if (points.length < 2) add('missing', 'edr', 'coords', 'required', "Draw the corridor's centre line on the map (at least 2 points)", 'map');
      checkLength(model, 'corridor-width', 'width-units', 'width', 'corridor width', add);
      checkLength(model, 'corridor-height', 'height-units', 'height', 'corridor height', add);
      break;
    case 'items':
      add('info', 'edr', 'query', 'list', "Lists the collection's items. The query builder can't set a bounding box or limit for items yet.");
      break;
    case 'instances':
      add('info', 'edr', 'query', 'list', "Lists the collection's instances (e.g. model runs). The query builder can't query a single instance yet.");
      break;
    case 'locations':
      if (!model.locationFeature) {
        add('info', 'edr', 'location', 'list', 'No location selected: the request lists all locations. Pick one on the map or in the Location Features list.');
      }
      break;
  }

  if (queryType === 'radius') {
    if (!(model.radius.value > 0)) add('error', 'edr', 'within', 'positive', 'The radius must be greater than 0', 'form');
    const units = unitsFor(model.variables, 'within');
    if (units.length > 0 && !units.includes(model.radius.units)) {
      add('error', 'metadata', 'within-units', 'offered',
        `Radius unit "${model.radius.units}" isn't offered by this collection (${units.join(', ')})`, 'form');
    }
  }
}

// A size and its unit set in the builder (corridor width and height): EDR requires both
function checkLength(model: QueryModel, field: string, unitField: string, unitKind: 'width' | 'height', label: string, add: Add) {
  const value = model.queryParams[field]?.trim() ?? '';
  if (!value) add('missing', 'edr', field, 'required', `Set the ${label}`, 'form');
  else if (!(Number(value) > 0)) add('error', 'edr', field, 'positive', `The ${label} must be a number greater than 0`, 'form');

  const unit = model.queryParams[unitField]?.trim() ?? '';
  const offered = unitsFor(model.variables, unitKind);
  if (!unit) add('missing', 'edr', unitField, 'required', `Pick the unit of the ${label}`, 'form');
  else if (offered.length > 0 && !offered.includes(unit)) {
    add('error', 'metadata', unitField, 'offered', `Unit "${unit}" isn't offered for the ${label} (${offered.join(', ')})`, 'form');
  }
}

function checkFormat(model: QueryModel, add: Add) {
  const formats = effectiveOutputFormats(model.collection, model.queryKey);
  if (model.format) {
    if (formats.length > 0 && !formats.includes(model.format)) {
      add('error', 'metadata', 'f', 'offered', `Output format "${model.format}" isn't offered for this query`, 'form');
    }
  } else {
    const fallback = model.variables?.default_output_format;
    add('info', 'metadata', 'f', 'default', `No output format selected: the server uses its default${fallback ? ` (${fallback})` : ''}`);
  }
}

function checkParameters(model: QueryModel, add: Add) {
  const ids = parameterIdsOf(model.collection);
  if (ids.length === 0) return;
  const unknown = model.parameters.filter(parameter => !ids.includes(parameter));
  if (unknown.length > 0) {
    add('error', 'metadata', 'parameter-name', 'offered', `Unknown parameter${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`, 'form');
  }
  const listsOnly = model.queryType === 'items' || model.queryType === 'instances'
    || (model.queryType === 'locations' && !model.locationFeature);
  if (model.parameters.length === 0 && !listsOnly) {
    add('info', 'metadata', 'parameter-name', 'all', 'No parameters selected: the server returns all parameters (or its default set)');
  }
}

const formatTime = (time: number) => (isFinite(time) ? new Date(time).toISOString().replace(':00.000Z', 'Z') : '…');

function checkDatetime(model: QueryModel, add: Add) {
  if (!model.collection.extent?.temporal) return;
  const { mode, value, start, end } = model.datetime;
  const chosen = mode === 'range' ? [start, end] : [value];
  const filled = chosen.filter(Boolean);

  if (filled.length === 0) {
    add('info', 'metadata', 'datetime', 'unset', 'No time selected: the server decides which times to return');
    return;
  }
  if (mode === 'range' && filled.length === 1) {
    add('missing', 'metadata', 'datetime', 'range', `Pick ${start ? 'an end' : 'a start'} time for the range`, 'form');
    return;
  }
  const times = filled.map(text => Date.parse(text));
  filled.forEach((text, i) => {
    if (isNaN(times[i])) add('error', 'metadata', 'datetime', `parse-${i}`, `"${text}" isn't a valid date-time`, 'form');
  });
  if (times.some(isNaN)) return;
  if (mode === 'range' && times[0] > times[1]) {
    add('error', 'metadata', 'datetime', 'order', 'The time range starts after it ends', 'form');
  }
  const extent = extentsOf(model.collection).time;
  if (extent && times.some(time => time < extent.min || time > extent.max)) {
    add('warning', 'metadata', 'datetime', 'extent',
      `The selected time is outside the collection's time extent (${formatTime(extent.min)} – ${formatTime(extent.max)})`, 'form');
  }
}

// z and custom dimensions share the single value / range pattern
function checkDimension(selection: DimSelection, field: string, label: string, add: Add) {
  if (selection.mode === 'range' && Boolean(selection.start) !== Boolean(selection.end)) {
    add('missing', 'metadata', field, 'range', `Pick ${selection.start ? 'the upper' : 'the lower'} end of the ${label} range`, 'form');
    return false;
  }
  return true;
}

function checkVertical(model: QueryModel, add: Add) {
  const levels = extentsOf(model.collection).levels;
  if (!levels || !checkDimension(model.vertical, 'z', 'level', add)) return;
  const { mode, value, start, end } = model.vertical;
  const chosen = (mode === 'range' ? [start, end] : [value]).filter(Boolean);
  const numbers = chosen.map(Number);
  chosen.forEach((text, i) => {
    if (!isFinite(numbers[i])) add('error', 'metadata', 'z', `number-${i}`, `Level "${text}" isn't a number`, 'form');
  });
  if (numbers.some(n => !isFinite(n))) return;
  if (mode === 'individual' && numbers.length === 1 && levels.values.length > 0 && !levels.values.includes(numbers[0])) {
    add('error', 'metadata', 'z', 'offered', `Level ${chosen[0]} isn't one of the collection's levels`, 'form');
  }
  // No order check for ranges: levels can run either way (pressure 1000/500 is a natural range)
  const range = levels.range;
  if (range && numbers.some(n => n < range.min || n > range.max)) {
    add('warning', 'metadata', 'z', 'extent', `The selected level is outside the collection's vertical extent (${range.min} – ${range.max})`, 'form');
  }
}

// What the query is still missing and what looks wrong, by EDR and the collection's metadata
export function validateQuery(model: QueryModel): QueryIssue[] {
  const issues: QueryIssue[] = [];
  const add: Add = (severity, source, field, rule, message, input) =>
    issues.push({ id: `${source}:${field}:${rule}`, severity, source, field, message, input });

  checkGeometry(model, add);
  checkFormat(model, add);
  if (model.queryType !== 'items' && model.queryType !== 'instances') {
    checkParameters(model, add);
    checkDatetime(model, add);
    checkVertical(model, add);
    Object.entries(model.customDims).forEach(([id, selection]) => checkDimension(selection, `dim:${id}`, id, add));
  }
  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

const FORM_FIELDS = new Set(['f', 'parameter-name', 'datetime', 'z']);

// Add the API docs' view to the query's own issues. Their issues go under the builder's field names,
// except on a field EDR or the metadata already flags: those are the stronger source, and one issue
// is enough. A parameter EDR requires but the API docs mark optional still counts as missing, noted.
export function addApiDocsIssues(model: QueryModel, issues: QueryIssue[], check: ApiDocsCheck): QueryIssue[] {
  const optional = new Set((check.operation?.entry.params ?? []).filter(param => param.in === 'query' && !param.required).map(param => param.name));
  const own = issues.map(issue => (issue.severity === 'missing' && optional.has(issue.field)
    ? { ...issue, message: `${issue.message} (the server's API docs mark it optional)` }
    : issue));
  const dimensionIds = new Set([...(model.collection.extent?.custom ?? []).map(dim => dim.id), ...Object.keys(model.customDims)]);
  const flagged = new Set(own.filter(issue => issue.severity !== 'info').map(issue => issue.field));
  const placed = check.issues
    .map(issue => {
      const field = dimensionIds.has(issue.field) ? `dim:${issue.field}` : issue.field;
      const input = FORM_FIELDS.has(field) || field.startsWith('dim:') ? 'form' as const : undefined;
      return { ...issue, id: issue.id.replace(`:${issue.field}:`, `:${field}:`), field, input };
    })
    .filter(issue => !flagged.has(issue.field));
  return [...own, ...placed].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export interface IssueSummary {
  missing: number;
  error: number;
  warning: number;
  info: number;
  needsAttention: boolean; // something is missing or wrong
}

export function summarizeIssues(issues: QueryIssue[]): IssueSummary {
  const count = (severity: IssueSeverity) => issues.filter(issue => issue.severity === severity).length;
  const summary = { missing: count('missing'), error: count('error'), warning: count('warning'), info: count('info') };
  return { ...summary, needsAttention: summary.missing + summary.error > 0 };
}
