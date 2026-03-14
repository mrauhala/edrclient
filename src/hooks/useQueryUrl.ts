import React, { useState, useEffect, useCallback } from 'react';
import { Collection, normalizeHref } from '../DataRetrievalAPI';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useCollection } from '../contexts/CollectionContext';

export interface UseQueryUrlReturn {
  // Query states
  selectedDataQuery: string;
  setSelectedDataQuery: (q: string) => void;
  selectedFormat: string;
  setSelectedFormat: (f: string) => void;
  selectedParameters: string[];
  setSelectedParameters: (p: string[]) => void;
  selectedDatetime: string;
  setSelectedDatetime: (d: string) => void;
  datetimeMode: 'individual' | 'range';
  setDatetimeMode: (m: 'individual' | 'range') => void;
  startDatetime: string;
  setStartDatetime: (d: string) => void;
  endDatetime: string;
  setEndDatetime: (d: string) => void;
  selectedVertical: string;
  setSelectedVertical: (v: string) => void;
  verticalMode: 'individual' | 'range';
  setVerticalMode: (m: 'individual' | 'range') => void;
  startVertical: string;
  setStartVertical: (v: string) => void;
  endVertical: string;
  setEndVertical: (v: string) => void;
  selectedCustomDimensions: {[dimensionId: string]: string};
  setSelectedCustomDimensions: React.Dispatch<React.SetStateAction<{[dimensionId: string]: string}>>;
  customDimensionModes: {[dimensionId: string]: 'individual' | 'range'};
  setCustomDimensionModes: React.Dispatch<React.SetStateAction<{[dimensionId: string]: 'individual' | 'range'}>>;
  customDimensionStarts: {[dimensionId: string]: string};
  setCustomDimensionStarts: React.Dispatch<React.SetStateAction<{[dimensionId: string]: string}>>;
  customDimensionEnds: {[dimensionId: string]: string};
  setCustomDimensionEnds: React.Dispatch<React.SetStateAction<{[dimensionId: string]: string}>>;
  // Utilities
  resetQueryState: () => void;
  getEffectiveOutputFormats: (collection: Collection, queryType: string) => string[];
  buildUrlWithParams: (
    baseUrl: string,
    format: string,
    parameters: string[],
    isDataQuery: boolean,
    coords?: [number, number][] | null,
    area?: [number, number][][] | null,
    radius?: number,
    queryType?: string,
    locationFeature?: any | null,
    datetime?: string,
    dtMode?: 'individual' | 'range',
    dtStart?: string,
    dtEnd?: string,
    vertical?: string,
    vMode?: 'individual' | 'range',
    vStart?: string,
    vEnd?: string,
    customDims?: {[dimensionId: string]: string},
    customDimModes?: {[dimensionId: string]: 'individual' | 'range'},
    customDimStarts?: {[dimensionId: string]: string},
    customDimEnds?: {[dimensionId: string]: string},
  ) => string;
}

export function useQueryUrl(): UseQueryUrlReturn {
  const { clickedCoords, selectedArea, radiusKm } = useMapInteraction();
  const { selectedCollection, selectedFeature, setCollectionUrl } = useCollection();

  const [selectedDataQuery, setSelectedDataQuery] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [selectedDatetime, setSelectedDatetime] = useState<string>('');
  const [datetimeMode, setDatetimeMode] = useState<'individual' | 'range'>('individual');
  const [startDatetime, setStartDatetime] = useState<string>('');
  const [endDatetime, setEndDatetime] = useState<string>('');
  const [selectedVertical, setSelectedVertical] = useState<string>('');
  const [verticalMode, setVerticalMode] = useState<'individual' | 'range'>('individual');
  const [startVertical, setStartVertical] = useState<string>('');
  const [endVertical, setEndVertical] = useState<string>('');
  const [selectedCustomDimensions, setSelectedCustomDimensions] = useState<{[dimensionId: string]: string}>({});
  const [customDimensionModes, setCustomDimensionModes] = useState<{[dimensionId: string]: 'individual' | 'range'}>({});
  const [customDimensionStarts, setCustomDimensionStarts] = useState<{[dimensionId: string]: string}>({});
  const [customDimensionEnds, setCustomDimensionEnds] = useState<{[dimensionId: string]: string}>({});

  const resetQueryState = useCallback(() => {
    setSelectedDataQuery('');
    setSelectedFormat('');
    setSelectedParameters([]);
    setSelectedDatetime('');
    setDatetimeMode('individual');
    setStartDatetime('');
    setEndDatetime('');
    setSelectedVertical('');
    setVerticalMode('individual');
    setStartVertical('');
    setEndVertical('');
    setSelectedCustomDimensions({});
    setCustomDimensionModes({});
    setCustomDimensionStarts({});
    setCustomDimensionEnds({});
  }, []);

  const getEffectiveOutputFormats = useCallback((collection: Collection, dataQueryType: string): string[] => {
    if (dataQueryType &&
        collection.data_queries[dataQueryType]?.link?.variables?.output_formats &&
        Array.isArray(collection.data_queries[dataQueryType].link.variables.output_formats) &&
        collection.data_queries[dataQueryType].link.variables.output_formats.length > 0) {
      return collection.data_queries[dataQueryType].link.variables.output_formats;
    }
    if (collection.output_formats && Array.isArray(collection.output_formats)) {
      return collection.output_formats;
    }
    return [];
  }, []);

  const buildUrlWithParams = useCallback((
    baseUrl: string,
    format: string,
    parameters: string[],
    isDataQuery: boolean,
    coords: [number, number][] | null | undefined = null,
    area: [number, number][][] | null | undefined = null,
    radius: number | undefined = undefined,
    queryType: string = '',
    locationFeature: any | null = null,
    datetime: string = '',
    dtMode: 'individual' | 'range' = 'individual',
    dtStart: string = '',
    dtEnd: string = '',
    vertical: string = '',
    vMode: 'individual' | 'range' = 'individual',
    vStart: string = '',
    vEnd: string = '',
    customDims: {[dimensionId: string]: string} = {},
    customDimModes: {[dimensionId: string]: 'individual' | 'range'} = {},
    customDimStarts: {[dimensionId: string]: string} = {},
    customDimEnds: {[dimensionId: string]: string} = {}
  ): string => {
    if (!baseUrl) return baseUrl;

    try {
      let url = new URL(baseUrl);

      if (queryType.toLowerCase() === 'locations' && locationFeature) {
        if (locationFeature.properties?.href) {
          url = new URL(locationFeature.properties.href);
        } else if (locationFeature.id) {
          const pathParts = url.pathname.split('/').filter(part => part.length > 0);
          const locationId = String(locationFeature.id);
          if (pathParts[pathParts.length - 1] !== locationId) {
            pathParts.push(locationId);
            url.pathname = '/' + pathParts.join('/');
          }
        }
      }

      if (isDataQuery) {
        if (format) {
          url.searchParams.set('f', format);
        } else {
          url.searchParams.delete('f');
        }

        if (parameters && parameters.length > 0) {
          url.searchParams.set('parameter-name', parameters.join(','));
        } else {
          url.searchParams.delete('parameter-name');
        }

        if (dtMode === 'range' && dtStart && dtEnd) {
          url.searchParams.set('datetime', `${dtStart}/${dtEnd}`);
        } else if (dtMode === 'individual' && datetime) {
          url.searchParams.set('datetime', datetime);
        } else {
          url.searchParams.delete('datetime');
        }

        if (vMode === 'range' && vStart && vEnd) {
          url.searchParams.set('z', `${vStart}/${vEnd}`);
        } else if (vMode === 'individual' && vertical) {
          url.searchParams.set('z', vertical);
        } else {
          url.searchParams.delete('z');
        }

        Object.keys(customDims).forEach(dimensionId => {
          const mode = customDimModes[dimensionId] || 'individual';
          const value = customDims[dimensionId];
          const start = customDimStarts[dimensionId];
          const end = customDimEnds[dimensionId];

          if (mode === 'range' && start && end) {
            url.searchParams.set(dimensionId, `${start}/${end}`);
          } else if (mode === 'individual' && value) {
            url.searchParams.set(dimensionId, value);
          } else {
            url.searchParams.delete(dimensionId);
          }
        });

        if (queryType.toLowerCase() === 'position' && coords && coords.length > 0) {
          if (coords.length === 1) {
            const [lon, lat] = coords[0];
            url.searchParams.set('coords', `POINT(${lon.toFixed(3)} ${lat.toFixed(3)})`);
          } else {
            const points = coords.map(c => `(${c[0].toFixed(3)} ${c[1].toFixed(3)})`).join(',');
            url.searchParams.set('coords', `MULTIPOINT(${points})`);
          }
        } else if (queryType.toLowerCase() === 'trajectory' && coords && coords.length > 1) {
          const linestring = coords.map(c => `${c[0].toFixed(3)} ${c[1].toFixed(3)}`).join(', ');
          url.searchParams.set('coords', `LINESTRING(${linestring})`);
        } else if (queryType.toLowerCase() === 'radius' && coords && coords.length > 0) {
          if (coords.length === 1) {
            const [lon, lat] = coords[0];
            url.searchParams.set('coords', `POINT(${lon.toFixed(3)} ${lat.toFixed(3)})`);
          } else {
            const points = coords.map(c => `(${c[0].toFixed(3)} ${c[1].toFixed(3)})`).join(',');
            url.searchParams.set('coords', `MULTIPOINT(${points})`);
          }
          if (radius !== undefined) {
            url.searchParams.set('within', radius.toString());
            url.searchParams.set('within-units', 'km');
          }
        } else if (queryType.toLowerCase() === 'area' && area && area.length > 0) {
          if (area.length === 1) {
            const wktCoords = area[0].map(coord => `${coord[0].toFixed(2)} ${coord[1].toFixed(2)}`).join(',');
            url.searchParams.set('coords', `POLYGON((${wktCoords}))`);
          } else {
            const polygons = area.map(polygon => {
              const wktCoords = polygon.map(coord => `${coord[0].toFixed(2)} ${coord[1].toFixed(2)}`).join(',');
              return `((${wktCoords}))`;
            }).join(',');
            url.searchParams.set('coords', `MULTIPOLYGON(${polygons})`);
          }
        } else if (queryType.toLowerCase() !== 'locations') {
          url.searchParams.delete('coords');
          url.searchParams.delete('within');
          url.searchParams.delete('within-units');
        }
      } else {
        url.searchParams.delete('f');
        url.searchParams.delete('parameter-name');
        url.searchParams.delete('datetime');
        url.searchParams.delete('z');
        Object.keys(customDims).forEach(dimensionId => {
          url.searchParams.delete(dimensionId);
        });
        url.searchParams.delete('coords');
        url.searchParams.delete('within');
        url.searchParams.delete('within-units');
      }

      return url.toString();
    } catch {
      return baseUrl;
    }
  }, []);

  // Consolidated URL rebuild effect — replaces 13 separate effects
  useEffect(() => {
    if (!selectedDataQuery || !selectedCollection) return;

    const dataQuery = selectedCollection.data_queries[selectedDataQuery];
    if (!dataQuery?.link?.href) return;

    const normalizedHref = normalizeHref(dataQuery.link.href);
    if (!normalizedHref) return;

    const queryLower = selectedDataQuery.toLowerCase();

    // Gate: only rebuild for specific query types when relevant state changes
    // The dependency array covers all query states, so we just rebuild unconditionally
    const locationFeature = queryLower === 'locations' ? selectedFeature : null;
    const coordsToUse = (queryLower === 'position' || queryLower === 'trajectory' || queryLower === 'radius') ? clickedCoords : null;
    const areaToUse = queryLower === 'area' ? selectedArea : null;

    // Determine effective datetime mode
    const hasValues = selectedCollection.extent?.temporal?.values && selectedCollection.extent.temporal.values.length > 0;
    const effectiveDatetimeMode = !hasValues ? 'range' as const : datetimeMode;

    const newUrl = buildUrlWithParams(
      normalizedHref,
      selectedFormat,
      selectedParameters,
      true,
      coordsToUse,
      areaToUse,
      radiusKm,
      selectedDataQuery,
      locationFeature,
      selectedDatetime,
      effectiveDatetimeMode,
      startDatetime,
      endDatetime,
      selectedVertical,
      verticalMode,
      startVertical,
      endVertical,
      selectedCustomDimensions,
      customDimensionModes,
      customDimensionStarts,
      customDimensionEnds
    );

    setCollectionUrl(newUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDataQuery, selectedFormat, selectedParameters,
    selectedDatetime, datetimeMode, startDatetime, endDatetime,
    selectedVertical, verticalMode, startVertical, endVertical,
    selectedCustomDimensions, customDimensionModes, customDimensionStarts, customDimensionEnds,
    clickedCoords, selectedArea, radiusKm, selectedFeature,
    selectedCollection
  ]);

  return {
    selectedDataQuery, setSelectedDataQuery,
    selectedFormat, setSelectedFormat,
    selectedParameters, setSelectedParameters,
    selectedDatetime, setSelectedDatetime,
    datetimeMode, setDatetimeMode,
    startDatetime, setStartDatetime,
    endDatetime, setEndDatetime,
    selectedVertical, setSelectedVertical,
    verticalMode, setVerticalMode,
    startVertical, setStartVertical,
    endVertical, setEndVertical,
    selectedCustomDimensions, setSelectedCustomDimensions,
    customDimensionModes, setCustomDimensionModes,
    customDimensionStarts, setCustomDimensionStarts,
    customDimensionEnds, setCustomDimensionEnds,
    resetQueryState,
    getEffectiveOutputFormats,
    buildUrlWithParams,
  };
}
