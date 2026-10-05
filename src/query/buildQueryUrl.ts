import type { QueryModel } from './queryModel';
import type { DimSelection } from './types';

// Parameters a query type takes from the builder's fields (queryParams)
export const TYPE_PARAMS: Readonly<Record<string, string[]>> = {
  corridor: ['corridor-width', 'width-units', 'corridor-height', 'height-units'],
};

const QUERY_PARAMS = ['f', 'parameter-name', 'datetime', 'z', 'coords', 'within', 'within-units', 'bbox', ...TYPE_PARAMS.corridor];

const lonLat = ([lon, lat]: [number, number]) => `${lon.toFixed(3)} ${lat.toFixed(3)}`;
const ring = (polygon: [number, number][]) => polygon.map(([lon, lat]) => `${lon.toFixed(2)} ${lat.toFixed(2)}`).join(',');

function pointsWkt(points: [number, number][]): string {
  return points.length === 1 ? `POINT(${lonLat(points[0])})` : `MULTIPOINT(${points.map(p => `(${lonLat(p)})`).join(',')})`;
}

function setDimension(params: URLSearchParams, name: string, selection: DimSelection) {
  if (selection.mode === 'range' && selection.start && selection.end) {
    params.set(name, `${selection.start}/${selection.end}`);
  } else if (selection.mode === 'individual' && selection.value) {
    params.set(name, selection.value);
  } else {
    params.delete(name);
  }
}

// The request URL for a data query: the query's href with the chosen parameters and geometry
export function buildQueryUrl(model: QueryModel): string | null {
  if (!model.baseHref) return null;
  try {
    let url = new URL(model.baseHref);
    const { queryType } = model;

    if (queryType === 'locations' && model.locationFeature) {
      if (model.locationFeature.properties?.href) {
        url = new URL(model.locationFeature.properties.href);
      } else if (model.locationFeature.id) {
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);
        const locationId = String(model.locationFeature.id);
        if (pathParts[pathParts.length - 1] !== locationId) {
          pathParts.push(locationId);
          url.pathname = '/' + pathParts.join('/');
        }
      }
    }

    const params = url.searchParams;
    if (model.format) params.set('f', model.format);
    else params.delete('f');
    if (model.parameters.length > 0) params.set('parameter-name', model.parameters.join(','));
    else params.delete('parameter-name');
    setDimension(params, 'datetime', model.datetime);
    setDimension(params, 'z', model.vertical);
    Object.entries(model.customDims).forEach(([id, selection]) => setDimension(params, id, selection));

    const { points, polygons } = model;
    if (queryType === 'position' && points.length > 0) {
      params.set('coords', pointsWkt(points));
    } else if ((queryType === 'trajectory' || queryType === 'corridor') && points.length > 1) {
      params.set('coords', `LINESTRING(${points.map(lonLat).join(', ')})`);
    } else if (queryType === 'radius' && points.length > 0) {
      params.set('coords', pointsWkt(points));
      params.set('within', model.radius.value.toString());
      params.set('within-units', model.radius.units);
    } else if (queryType === 'cube' && model.bbox) {
      const [west, south, east, north] = model.bbox;
      params.set('bbox', [west, south, east, north].map(edge => edge.toFixed(3)).join(','));
      if (model.bboxAsCoords) {
        const corners: [number, number][] = [[west, south], [west, north], [east, north], [east, south], [west, south]];
        params.set('coords', `POLYGON((${corners.map(lonLat).join(',')}))`);
      } else {
        params.delete('coords');
      }
    } else if (queryType === 'area' && polygons.length > 0) {
      params.set('coords', polygons.length === 1
        ? `POLYGON((${ring(polygons[0])}))`
        : `MULTIPOLYGON(${polygons.map(polygon => `((${ring(polygon)}))`).join(',')})`);
    } else if (queryType !== 'locations') {
      params.delete('coords');
      params.delete('within');
      params.delete('within-units');
      params.delete('bbox');
    }
    for (const name of TYPE_PARAMS[queryType] ?? []) {
      const value = model.queryParams[name]?.trim();
      if (value) params.set(name, value);
      else params.delete(name);
    }

    return url.toString();
  } catch {
    return model.baseHref;
  }
}

// A collection URL without any data query parameters
export function collectionBaseUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    QUERY_PARAMS.forEach(param => parsed.searchParams.delete(param));
    return parsed.toString();
  } catch {
    return url;
  }
}
