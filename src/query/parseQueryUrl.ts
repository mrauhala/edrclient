import type { Collection } from '../types/api';
import { normalizeHref } from '../utils/href';
import { TYPE_PARAMS } from './buildQueryUrl';
import { emptyDim } from './queryModel';
import { geometryKindOf, queryTypeOf, queryVariables, unitsFor } from './queryTypes';
import type { BBox, DimSelection } from './types';

// The way back from a request URL to the query builder: the inverse of buildQueryUrl. Only what the
// form can hold comes out. The rest, like `coords=garbage`, stays in the URL, which is what's sent.

type LonLat = [number, number];

export interface QueryTarget {
  queryKey: string;
  locationId?: string; // a locations query for one location
}

export interface QuerySelections {
  format: string;
  parameters: string[];
  datetime: DimSelection;
  vertical: DimSelection;
  customDims: Record<string, DimSelection>;
  points: LonLat[];
  polygons: LonLat[][];
  bbox: BBox | null;
  bboxAsCoords: boolean;
  // null: not one the form can hold, so it keeps its own
  radius: number | null;
  radiusUnits: string | null;
  queryParams: Record<string, string>;
}

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// Decoded to compare: a server's links may write an instance's time with `:`, and a typed URL with %3A
function originAndPath(url: string): string | null {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${decoded(pathname).replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

const hrefPaths = (collection: Collection) => Object.entries(collection.data_queries ?? {}).flatMap(([queryKey, query]) => {
  const path = originAndPath(normalizeHref(query?.link?.href) ?? '');
  return path ? [{ queryKey, path, queryType: queryTypeOf(collection, queryKey) }] : [];
});

// Which of a collection's or instance's data queries a request URL is for
export function matchDataQuery(url: string, collection: Collection): QueryTarget | null {
  const path = originAndPath(url);
  if (!path) return null;
  for (const query of hrefPaths(collection)) {
    if (path === query.path) return { queryKey: query.queryKey };
    const below = path.startsWith(`${query.path}/`) ? path.slice(query.path.length + 1) : null;
    if (query.queryType === 'locations' && below && !below.includes('/')) {
      return { queryKey: query.queryKey, locationId: below };
    }
  }
  return null;
}

// Which instance of a collection a request URL is for, the instances query that lists them, and
// whether the URL goes on to a query on the instance
export function matchInstance(url: string, collection: Collection): { queryKey: string; instanceId: string; hasQuery: boolean } | null {
  const path = originAndPath(url);
  if (!path) return null;
  for (const query of hrefPaths(collection)) {
    if (query.queryType === 'instances' && path.startsWith(`${query.path}/`)) {
      const [instanceId, ...rest] = path.slice(query.path.length + 1).split('/');
      return { queryKey: query.queryKey, instanceId, hasQuery: rest.length > 0 };
    }
  }
  return null;
}

// Whether the form can follow this URL at all: it's for the open collection
export const isForCollection = (url: string, collection: Collection): boolean =>
  !!matchDataQuery(url, collection) || !!matchInstance(url, collection);

// A single value or an interval, which may be open-ended (start/.. or ../end)
function dimension(text: string | null): DimSelection {
  if (!text) return emptyDim();
  const parts = text.split('/');
  return parts.length === 2 ? { mode: 'range', value: '', start: parts[0], end: parts[1] } : { mode: 'individual', value: text, start: '', end: '' };
}

const NUMBER = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';
const PAIR = new RegExp(`^\\s*(${NUMBER})\\s+(${NUMBER})\\s*$`);

function pairs(text: string): LonLat[] | null {
  const parsed = text.split(',').map(pair => PAIR.exec(pair));
  return parsed.every(Boolean) ? parsed.map(match => [Number(match![1]), Number(match![2])]) : null;
}

const wkt = (text: string) => /^\s*([A-Za-z]+)\s*\((.*)\)\s*$/s.exec(text);

// POINT or MULTIPOINT, with its points in parentheses or not
function wktPoints(text: string): LonLat[] | null {
  const match = wkt(text);
  const type = match?.[1].toUpperCase();
  if (type === 'POINT') return pairs(match![2]);
  if (type === 'MULTIPOINT') return pairs(match![2].replace(/[()]/g, ''));
  return null;
}

function wktLine(text: string): LonLat[] | null {
  const match = wkt(text);
  return match?.[1].toUpperCase() === 'LINESTRING' ? pairs(match[2]) : null;
}

// POLYGON or MULTIPOLYGON. The form has no holes, so a polygon with an inner ring isn't one it can hold.
function wktPolygons(text: string): LonLat[][] | null {
  const match = wkt(text);
  const type = match?.[1].toUpperCase();
  if (type === 'POLYGON') {
    const ring = /^\s*\(([^()]*)\)\s*$/.exec(match![2]);
    const points = ring && pairs(ring[1]);
    return points ? [points] : null;
  }
  if (type === 'MULTIPOLYGON') {
    const shape = /\(\s*\(([^()]*)\)\s*\)/g;
    if (match![2].replace(shape, '').replace(/[\s,]/g, '')) return null;
    const rings = [...match![2].matchAll(shape)].map(ring => pairs(ring[1]));
    return rings.every(Boolean) ? rings as LonLat[][] : null;
  }
  return null;
}

function boxOf(text: string | null): BBox | null {
  const parts = text?.split(',').map(Number);
  return parts?.length === 4 && parts.every(Number.isFinite) ? parts as BBox : null;
}

// What a request URL says, in the form's terms
export function readQuerySelections(url: string, collection: Collection, queryKey: string): QuerySelections {
  const params = new URL(url).searchParams;
  const queryType = queryTypeOf(collection, queryKey);
  const kind = geometryKindOf(queryType);
  const coords = params.get('coords') ?? '';

  const within = params.get('within');
  const radius = within?.trim() && Number.isFinite(Number(within)) ? Number(within) : null;
  const units = params.get('within-units');
  const offered = unitsFor(queryVariables(collection, queryKey), 'within');

  const customDims: Record<string, DimSelection> = {};
  for (const { id } of collection.extent?.custom ?? []) {
    if (params.has(id)) customDims[id] = dimension(params.get(id));
  }

  return {
    format: params.get('f') ?? '',
    parameters: (params.get('parameter-name') ?? '').split(',').map(name => name.trim()).filter(Boolean),
    datetime: dimension(params.get('datetime')),
    vertical: dimension(params.get('z')),
    customDims,
    points: (kind === 'points' ? wktPoints(coords) : kind === 'line' ? wktLine(coords) : null) ?? [],
    polygons: (kind === 'polygon' ? wktPolygons(coords) : null) ?? [],
    bbox: kind === 'bbox' ? boxOf(params.get('bbox')) : null,
    bboxAsCoords: kind === 'bbox' && params.has('coords'),
    radius,
    radiusUnits: units && (offered.length === 0 || offered.includes(units)) ? units : null,
    queryParams: Object.fromEntries((TYPE_PARAMS[queryType] ?? []).map(name => [name, params.get(name) ?? ''])),
  };
}
