import type { ServiceType } from '../types/ServiceType';
import type { Collection } from '../types/api';

export type FilterField = 'title' | 'description' | 'keywords' | 'id';
export type ActiveTab = 'services' | 'collections' | 'items';

export const DEFAULT_FILTERS = new Set<FilterField>(['title', 'description', 'keywords', 'id']);

export interface ServiceItem {
  label: string;
  url: string;
  type?: ServiceType;
  isActive: boolean;
}

export interface CollectionResult {
  collection: Collection;
  originalIndex: number;
  matchedKeywords: string[];
}

export interface FeatureItem {
  id?: string | number;
  type: string;
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
}

export interface ItemResult {
  feature: FeatureItem;
  displayName: string;
  geometryType: string;
}

export const GEOMETRY_CHIP_COLORS: Record<string, { bgcolor: string; borderColor: string; color: string }> = {
  Point: { bgcolor: '#e8f5e9', borderColor: '#a5d6a7', color: '#2e7d32' },
  MultiPoint: { bgcolor: '#e8f5e9', borderColor: '#a5d6a7', color: '#2e7d32' },
  LineString: { bgcolor: '#fff3e0', borderColor: '#ffcc80', color: '#e65100' },
  MultiLineString: { bgcolor: '#fff3e0', borderColor: '#ffcc80', color: '#e65100' },
  Polygon: { bgcolor: '#e3f2fd', borderColor: '#90caf9', color: '#1565c0' },
  MultiPolygon: { bgcolor: '#ede7f6', borderColor: '#b39ddb', color: '#4527a0' },
};
