import type { Collection, QueryVariables } from '../types/api';

// The kind of geometry a query type takes from the map
export type GeometryKind = 'points' | 'line' | 'polygon' | 'bbox' | 'none';

const GEOMETRY_KINDS: Record<string, GeometryKind> = {
  position: 'points',
  radius: 'points',
  trajectory: 'line',
  corridor: 'line',
  area: 'polygon',
  cube: 'bbox',
  items: 'bbox',
};

export function queryVariables(collection: Collection, queryKey: string): QueryVariables | undefined {
  return collection.data_queries?.[queryKey]?.link?.variables;
}

// The EDR query type of a data query: its declared query_type, else its key
export function queryTypeOf(collection: Collection, queryKey: string): string {
  const declared = queryVariables(collection, queryKey)?.query_type;
  return (typeof declared === 'string' && declared ? declared : queryKey).toLowerCase();
}

export function geometryKindOf(queryType: string): GeometryKind {
  return GEOMETRY_KINDS[queryType] ?? 'none';
}

// Units a query offers, e.g. within_units for radius. Accepts FMI's hyphenated keys (width-units)
export function unitsFor(variables: QueryVariables | undefined, kind: 'within' | 'width' | 'height'): string[] {
  const units = variables?.[`${kind}_units`] ?? variables?.[`${kind}-units`];
  return Array.isArray(units) ? units.filter((unit): unit is string => typeof unit === 'string') : [];
}

// Parameter ids as the builder offers them: `id` of each entry, or the keys of a parameter map
export function parameterIdsOf(collection: Collection): string[] {
  const parameters = collection.parameter_names;
  if (!parameters) return [];
  return Array.isArray(parameters) ? parameters.map(parameter => parameter.id) : Object.keys(parameters);
}

// Output formats of a data query, falling back to the collection's formats
export function effectiveOutputFormats(collection: Collection, queryKey: string): string[] {
  const formats = queryKey ? queryVariables(collection, queryKey)?.output_formats : undefined;
  if (Array.isArray(formats) && formats.length > 0) return formats;
  return Array.isArray(collection.output_formats) ? collection.output_formats : [];
}
