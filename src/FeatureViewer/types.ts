export interface FeatureLink {
  href: string;
  rel?: string;
  type?: string;
  title?: string;
}

export interface NormalizedFeature {
  id?: string | number;
  geometry?: {
    type: string;
    coordinates?: unknown;
  };
  properties: Record<string, unknown>;
  links?: FeatureLink[];
}

export interface FeatureViewerProps {
  feature: NormalizedFeature | null;
  onClose: () => void;
  variant: 'location' | 'geojson';
  layout?: 'overlay' | 'inline';
  metadata?: { numberReturned?: number; numberMatched?: number };
  onSelectLabelProperty?: (propertyName: string) => void;
  selectedLabelProperty?: string;
}

/** Normalize a plain GeoJSON feature object */
export function normalizeGeoJsonFeature(feature: Record<string, unknown>): NormalizedFeature {
  return {
    id: feature.id as string | number | undefined,
    geometry: feature.geometry as NormalizedFeature['geometry'],
    properties: (feature.properties as Record<string, unknown>) || {},
    links: feature.links as FeatureLink[] | undefined,
  };
}

/** Normalize an OpenLayers Feature object */
export function normalizeOLFeature(olFeature: Record<string, unknown>): NormalizedFeature {
  const getProps = olFeature.getProperties as (() => Record<string, unknown>) | undefined;
  const getGeom = olFeature.getGeometry as (() => Record<string, unknown>) | undefined;

  const props = getProps ? getProps.call(olFeature) : {};
  const geometry = getGeom ? getGeom.call(olFeature) : undefined;

  let normalizedGeometry: NormalizedFeature['geometry'] | undefined;
  if (geometry) {
    const getType = (geometry as Record<string, unknown>).getType as (() => string) | undefined;
    const getCoords = (geometry as Record<string, unknown>).getCoordinates as (() => unknown) | undefined;
    normalizedGeometry = {
      type: getType ? getType.call(geometry) : 'Unknown',
      coordinates: getCoords ? getCoords.call(geometry) : undefined,
    };
  }

  const filteredProps = Object.fromEntries(
    Object.entries(props).filter(([key]) => key !== 'geometry' && !key.startsWith('_'))
  );

  return {
    id: props.id as string | number | undefined,
    geometry: normalizedGeometry,
    properties: filteredProps,
    links: props.links as FeatureLink[] | undefined,
  };
}

/** Format coordinates based on geometry type */
export function formatCoordinates(coords: unknown, geomType: string): string {
  if (!coords) return 'N/A';

  if (geomType === 'Point') {
    if (Array.isArray(coords) && coords.length >= 2) {
      return `[${(coords[1] as number)?.toFixed(6)}, ${(coords[0] as number)?.toFixed(6)}]`;
    }
    return JSON.stringify(coords);
  } else if (geomType === 'LineString') {
    return `LineString with ${(coords as unknown[]).length} points`;
  } else if (geomType === 'Polygon') {
    return `Polygon with ${((coords as unknown[][])[0]?.length || 0)} vertices`;
  } else if (geomType === 'MultiPoint') {
    return `MultiPoint with ${(coords as unknown[]).length} points`;
  } else if (geomType === 'MultiLineString') {
    return `MultiLineString with ${(coords as unknown[]).length} linestrings`;
  } else if (geomType === 'MultiPolygon') {
    return `MultiPolygon with ${(coords as unknown[]).length} polygons`;
  }
  return 'Complex geometry';
}
