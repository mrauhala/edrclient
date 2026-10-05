import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Collection } from '../DataRetrievalAPI';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useCollection } from '../contexts/CollectionContext';
import { useQueryValidationContext } from '../contexts/QueryValidationContext';
import { buildQueryModel } from '../query/queryModel';
import { buildQueryUrl } from '../query/buildQueryUrl';
import { effectiveOutputFormats, queryTypeOf } from '../query/queryTypes';
import { validateQuery } from '../query/validateQuery';
import type { DimSelection } from '../query/types';

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
  selectDataQuery: (collection: Collection, queryType: string) => void;
}

export function useQueryUrl(): UseQueryUrlReturn {
  const { clickedCoords, setClickedCoords, selectedArea, radiusKm, setDataQuery } = useMapInteraction();
  const { selectedCollection, selectedFeature, setCollectionUrl } = useCollection();
  const { setQueryValidation } = useQueryValidationContext();

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

  const getEffectiveOutputFormats = effectiveOutputFormats;

  // Switch the data query: keep the output format if the new query offers it, otherwise use the
  // query's default; sync the map's query mode and drop clicked points other queries can't use
  const selectDataQuery = useCallback((collection: Collection, queryType: string) => {
    setSelectedDataQuery(queryType);
    setSelectedFormat(current => {
      const formats = getEffectiveOutputFormats(collection, queryType);
      if (current && formats.includes(current)) return current;
      const defaultFormat = collection.data_queries[queryType]?.link?.variables?.default_output_format;
      return defaultFormat && formats.includes(defaultFormat) ? defaultFormat : '';
    });
    setDataQuery(queryType);
    if (queryType.toLowerCase() !== 'position') {
      setClickedCoords([]);
    }
  }, [getEffectiveOutputFormats, setDataQuery, setClickedCoords]);

  // Selecting a location (on the map, in the Location Features list or via search) switches the
  // query to `locations`, so the request targets that location
  useEffect(() => {
    if (!selectedFeature || !selectedCollection?.data_queries) return;
    const locationsQuery = Object.keys(selectedCollection.data_queries).find(q => q.toLowerCase() === 'locations');
    if (locationsQuery && selectedDataQuery !== locationsQuery) {
      selectDataQuery(selectedCollection, locationsQuery);
    }
    // Only a new selection switches the query, not the user picking another query afterwards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeature]);

  // Custom dimensions as single values or ranges. A dimension switched to range mode has no
  // single value, so take the ids from every map.
  const customDims = useMemo(() => {
    const ids = new Set([
      ...Object.keys(selectedCustomDimensions), ...Object.keys(customDimensionModes),
      ...Object.keys(customDimensionStarts), ...Object.keys(customDimensionEnds),
    ]);
    return Object.fromEntries([...ids].map((id): [string, DimSelection] => [id, {
      mode: customDimensionModes[id] || 'individual',
      value: selectedCustomDimensions[id] || '',
      start: customDimensionStarts[id] || '',
      end: customDimensionEnds[id] || '',
    }]));
  }, [selectedCustomDimensions, customDimensionModes, customDimensionStarts, customDimensionEnds]);

  // The data query as one model: it builds the request URL and is validated
  const queryModel = useMemo(() => {
    if (!selectedCollection || !selectedDataQuery) return null;
    return buildQueryModel({
      collection: selectedCollection,
      queryKey: selectedDataQuery,
      format: selectedFormat,
      parameters: selectedParameters,
      datetime: { mode: datetimeMode, value: selectedDatetime, start: startDatetime, end: endDatetime },
      vertical: { mode: verticalMode, value: selectedVertical, start: startVertical, end: endVertical },
      customDims,
      points: clickedCoords,
      polygons: selectedArea,
      radius: { value: radiusKm, units: 'km' },
      locationFeature: queryTypeOf(selectedCollection, selectedDataQuery) === 'locations' ? selectedFeature : null,
    });
  }, [
    selectedCollection, selectedDataQuery, selectedFormat, selectedParameters,
    datetimeMode, selectedDatetime, startDatetime, endDatetime,
    verticalMode, selectedVertical, startVertical, endVertical,
    customDims, clickedCoords, selectedArea, radiusKm, selectedFeature,
  ]);

  // Publish the request URL and what the query is still missing
  useEffect(() => {
    const url = queryModel ? buildQueryUrl(queryModel) : null;
    if (!queryModel || !url) {
      setQueryValidation(null);
      return;
    }
    setCollectionUrl(url);
    setQueryValidation({ url, issues: validateQuery(queryModel) });
  }, [queryModel, setCollectionUrl, setQueryValidation]);

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
    selectDataQuery,
  };
}
