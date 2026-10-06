import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Collection } from '../DataRetrievalAPI';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useCollection } from '../contexts/CollectionContext';
import { useQueryValidationContext } from '../contexts/QueryValidationContext';
import { useOpenApi } from '../contexts/OpenApiContext';
import { buildQueryModel, emptyDim } from '../query/queryModel';
import { EDR_QUERY_RULES } from '../query/edrRules';
import { buildQueryUrl } from '../query/buildQueryUrl';
import { effectiveOutputFormats, queryTypeOf, queryVariables, unitsFor } from '../query/queryTypes';
import { pickUnit } from '../query/units';
import { addApiDocsIssues, validateQuery } from '../query/validateQuery';
import { checkQueryUrlAgainstOpenApi } from '../validation/openapi/checkQueryUrl';
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
  // Parameters of the query type set in their own fields (corridor width and height)
  queryParams: Record<string, string>;
  setQueryParam: (name: string, value: string) => void;
  // Cube: also send the box as coords, for servers whose API docs require coords
  bboxAsCoords: boolean;
  setBboxAsCoords: (value: boolean) => void;
  // Feature lists (items): the time is an optional filter, off unless chosen
  filterByTime: boolean;
  setFilterByTime: (value: boolean) => void;
  // Utilities
  resetQueryState: () => void;
  getEffectiveOutputFormats: (collection: Collection, queryType: string) => string[];
  selectDataQuery: (collection: Collection, queryType: string) => void;
}

export function useQueryUrl(): UseQueryUrlReturn {
  const { clickedCoords, selectedArea, selectedBbox, radius, radiusUnits, setRadiusUnits, setDataQuery } = useMapInteraction();
  const { selectedCollection, selectedFeature, setCollectionUrl } = useCollection();
  const { setQueryValidation } = useQueryValidationContext();
  const { index: apiIndex } = useOpenApi();

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
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bboxAsCoords, setBboxAsCoords] = useState(false);
  const [filterByTime, setFilterByTime] = useState(false);
  const setQueryParam = useCallback((name: string, value: string) => setQueryParams(params => ({ ...params, [name]: value })), []);

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
    setQueryParams({});
    setBboxAsCoords(false);
    setFilterByTime(false);
  }, []);

  const getEffectiveOutputFormats = effectiveOutputFormats;

  // Switch the data query: keep the output format if the new query offers it, otherwise use the
  // query's default; tell the map the query type, which drops geometry the new type can't use
  const selectDataQuery = useCallback((collection: Collection, queryKey: string) => {
    setSelectedDataQuery(queryKey);
    setSelectedFormat(current => {
      const formats = getEffectiveOutputFormats(collection, queryKey);
      if (current && formats.includes(current)) return current;
      const defaultFormat = collection.data_queries[queryKey]?.link?.variables?.default_output_format;
      return defaultFormat && formats.includes(defaultFormat) ? defaultFormat : '';
    });
    const queryType = queryKey ? queryTypeOf(collection, queryKey) : '';
    const variables = queryVariables(collection, queryKey);
    if (queryType === 'radius') {
      setRadiusUnits(pickUnit(unitsFor(variables, 'within'), radiusUnits));
    }
    // A corridor starts 10 wide in the preferred width unit; the height unit is the first offered.
    // Without vertical levels a corridor has no height.
    if (queryType === 'corridor') {
      const hasLevels = !!collection.extent?.vertical;
      setQueryParams(params => ({
        ...params,
        'corridor-width': params['corridor-width'] || '10',
        'width-units': pickUnit(unitsFor(variables, 'width'), params['width-units'] || 'km'),
        'corridor-height': hasLevels ? params['corridor-height'] ?? '' : '',
        'height-units': hasLevels ? pickUnit(unitsFor(variables, 'height'), params['height-units'] || '') : '',
      }));
    }
    setDataQuery(queryType);
  }, [getEffectiveOutputFormats, setDataQuery, setRadiusUnits, radiusUnits]);

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
    // Items are listed from any time unless the time filter is on (the time control always holds a time)
    const timeIsFilter = !!EDR_QUERY_RULES[queryTypeOf(selectedCollection, selectedDataQuery)]?.featureList;
    return buildQueryModel({
      collection: selectedCollection,
      queryKey: selectedDataQuery,
      format: selectedFormat,
      parameters: selectedParameters,
      datetime: timeIsFilter && !filterByTime
        ? emptyDim()
        : { mode: datetimeMode, value: selectedDatetime, start: startDatetime, end: endDatetime },
      vertical: { mode: verticalMode, value: selectedVertical, start: startVertical, end: endVertical },
      customDims,
      points: clickedCoords,
      polygons: selectedArea,
      bbox: selectedBbox,
      bboxAsCoords,
      radius: { value: radius, units: radiusUnits },
      queryParams,
      locationFeature: queryTypeOf(selectedCollection, selectedDataQuery) === 'locations' ? selectedFeature : null,
    });
  }, [
    selectedCollection, selectedDataQuery, selectedFormat, selectedParameters,
    datetimeMode, selectedDatetime, startDatetime, endDatetime, filterByTime,
    verticalMode, selectedVertical, startVertical, endVertical,
    customDims, clickedCoords, selectedArea, selectedBbox, bboxAsCoords, radius, radiusUnits, queryParams, selectedFeature,
  ]);

  // Publish the request URL and what the query is still missing, adding the API docs' view once
  // the service's API definition is loaded
  useEffect(() => {
    const url = queryModel ? buildQueryUrl(queryModel) : null;
    if (!queryModel || !url) {
      setQueryValidation(null);
      return;
    }
    setCollectionUrl(url);
    const issues = validateQuery(queryModel);
    const apiDocs = apiIndex ? checkQueryUrlAgainstOpenApi(url, apiIndex) : null;
    const operation = apiDocs?.operation?.entry;
    setQueryValidation({
      url,
      issues: apiDocs ? addApiDocsIssues(queryModel, issues, apiDocs) : issues,
      apiOperation: operation ? {
        template: operation.template,
        pointer: operation.pointer,
        required: operation.params.filter(param => param.in === 'query' && param.required).map(param => param.name),
      } : null,
    });
  }, [queryModel, apiIndex, setCollectionUrl, setQueryValidation]);

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
    queryParams, setQueryParam,
    bboxAsCoords, setBboxAsCoords,
    filterByTime, setFilterByTime,
    resetQueryState,
    getEffectiveOutputFormats,
    selectDataQuery,
  };
}
