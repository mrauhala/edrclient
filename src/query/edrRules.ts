import type { GeometryKind } from './queryTypes';

// What OGC API - EDR requires of each query type (from the EDR OpenAPI definitions)
export interface EdrQueryRule {
  geometry: GeometryKind;
  minVertices: number; // points per geometry: 1 for points, 2 for a line, 3 for a polygon ring
  required: string[]; // query parameters EDR requires
}

export const EDR_QUERY_RULES: Readonly<Record<string, EdrQueryRule>> = {
  position: { geometry: 'points', minVertices: 1, required: ['coords'] },
  radius: { geometry: 'points', minVertices: 1, required: ['coords', 'within', 'within-units'] },
  area: { geometry: 'polygon', minVertices: 3, required: ['coords'] },
  cube: { geometry: 'bbox', minVertices: 0, required: ['bbox'] },
  trajectory: { geometry: 'line', minVertices: 2, required: ['coords'] },
  corridor: {
    geometry: 'line',
    minVertices: 2,
    required: ['coords', 'corridor-width', 'width-units', 'corridor-height', 'height-units'],
  },
  items: { geometry: 'bbox', minVertices: 0, required: [] },
  locations: { geometry: 'none', minVertices: 0, required: [] },
  instances: { geometry: 'none', minVertices: 0, required: [] },
};
