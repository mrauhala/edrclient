import type { Collection, QueryVariables } from '../types/api';
import { normalizeHref } from '../utils/href';
import { EDR_QUERY_RULES, type EdrQueryRule } from './edrRules';
import { queryTypeOf } from './queryTypes';
import type { DimSelection } from './types';

// The parts of a selected location feature that address it
export interface LocationFeature {
  id?: string | number;
  properties?: { href?: string } | null;
}

// Everything the query builder and the map have chosen for a data query. The same model drives
// both the request URL and its validation, so the two can't disagree.
export interface QueryModelInput {
  collection: Collection;
  queryKey: string; // key in collection.data_queries
  format: string;
  parameters: string[];
  datetime: DimSelection;
  vertical: DimSelection;
  customDims: Record<string, DimSelection>;
  points: [number, number][]; // map clicks: position/radius points, trajectory vertices
  polygons: [number, number][][]; // drawn areas
  radius: { value: number; units: string };
  queryParams: Record<string, string>; // parameters of the query type, e.g. corridor-width; empty ones aren't sent
  locationFeature: LocationFeature | null; // selected location feature, for locations queries
}

export interface QueryModel extends QueryModelInput {
  queryType: string;
  rule?: EdrQueryRule;
  variables?: QueryVariables;
  baseHref: string | null;
}

export function buildQueryModel(input: QueryModelInput): QueryModel | null {
  const query = input.queryKey ? input.collection.data_queries?.[input.queryKey] : undefined;
  if (!query) return null;
  const queryType = queryTypeOf(input.collection, input.queryKey);
  return {
    ...input,
    queryType,
    rule: EDR_QUERY_RULES[queryType],
    variables: query.link?.variables,
    baseHref: normalizeHref(query.link?.href),
  };
}

export const emptyDim = (mode: DimSelection['mode'] = 'individual'): DimSelection => ({ mode, value: '', start: '', end: '' });
