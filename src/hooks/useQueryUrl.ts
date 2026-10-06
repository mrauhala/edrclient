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
import { useInstances, type InstancesState } from './useInstances';
import { instanceStep, type Instance } from '../query/instances';
import { normalizeHref } from '../utils/href';
import type { DimSelection, QueryIssue } from '../query/types';

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
  // Instances queries: the collection's instances (loaded on demand), the one picked and the query
  // run on it. The query fields then describe the instance.
  instances: InstancesState;
  selectedInstance: Instance | null;
  selectInstance: (id: string) => void;
  instanceQueryKey: string;
  selectInstanceQuery: (queryKey: string) => void;
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
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [instanceQueryKey, setInstanceQueryKey] = useState('');
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
    setSelectedInstanceId('');
    setInstanceQueryKey('');
  }, []);

  const getEffectiveOutputFormats = effectiveOutputFormats;

  // Settings a newly picked query starts from: keep the output format if the query offers it,
  // otherwise use its default; units it offers; and tell the map the query type, which drops
  // geometry the new type can't use. The query is a collection's, or an instance's.
  const applyQueryDefaults = useCallback((collection: Collection, queryKey: string) => {
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

  // Switch the collection's data query, leaving any instance
  const selectDataQuery = useCallback((collection: Collection, queryKey: string) => {
    setSelectedDataQuery(queryKey);
    setSelectedInstanceId('');
    setInstanceQueryKey('');
    applyQueryDefaults(collection, queryKey);
  }, [applyQueryDefaults]);

  // An instances query loads the instances; picking one and a query on it makes a data query
  const instancesHref = selectedCollection && selectedDataQuery && queryTypeOf(selectedCollection, selectedDataQuery) === 'instances'
    ? normalizeHref(selectedCollection.data_queries[selectedDataQuery]?.link?.href)
    : null;
  const instances = useInstances(instancesHref);
  const selectedInstance = instances.instances.find(instance => String(instance.id) === selectedInstanceId) ?? null;

  // Pick an instance, keeping the query if it has one too. A time from another run may lie outside
  // this one, so the time control picks one again.
  const selectInstance = useCallback((id: string) => {
    setSelectedInstanceId(id);
    setSelectedDatetime('');
    setStartDatetime('');
    setEndDatetime('');
    const instance = instances.instances.find(candidate => String(candidate.id) === id);
    if (instance && instanceQueryKey && instance.data_queries?.[instanceQueryKey]) {
      applyQueryDefaults(instance, instanceQueryKey);
    } else {
      setInstanceQueryKey('');
      setDataQuery('instances');
    }
  }, [instances.instances, instanceQueryKey, applyQueryDefaults, setDataQuery]);

  const selectInstanceQuery = useCallback((queryKey: string) => {
    setInstanceQueryKey(queryKey);
    if (selectedInstance && queryKey) applyQueryDefaults(selectedInstance, queryKey);
    else setDataQuery('instances');
  }, [selectedInstance, applyQueryDefaults, setDataQuery]);

  // Selecting a location (on the map, in the Location Features list or via search) switches the
  // query to `locations`, so the request targets that location
  useEffect(() => {
    if (!selectedFeature) return;
    // Inside an instance the location is queried through the instance's own locations query
    if (selectedInstance) {
      const instanceLocations = Object.keys(selectedInstance.data_queries ?? {}).find(q => q.toLowerCase() === 'locations');
      if (instanceLocations && instanceQueryKey !== instanceLocations) selectInstanceQuery(instanceLocations);
      return;
    }
    if (!selectedCollection?.data_queries) return;
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

  // What is queried: the collection's data query, or in an instances query the picked instance's
  const target = useMemo(() => {
    if (instancesHref) return selectedInstance && instanceQueryKey ? { collection: selectedInstance, queryKey: instanceQueryKey } : null;
    return selectedCollection && selectedDataQuery ? { collection: selectedCollection, queryKey: selectedDataQuery } : null;
  }, [instancesHref, selectedInstance, instanceQueryKey, selectedCollection, selectedDataQuery]);

  // The data query as one model: it builds the request URL and is validated
  const queryModel = useMemo(() => {
    if (!target) return null;
    const queryType = queryTypeOf(target.collection, target.queryKey);
    // Items are listed from any time unless the time filter is on (the time control always holds a time)
    const timeIsFilter = !!EDR_QUERY_RULES[queryType]?.featureList;
    // A location's href points at the collection's locations; an instance's is addressed by id
    const locationFeature = queryType !== 'locations' || !selectedFeature ? null
      : instancesHref ? { id: selectedFeature.id } : selectedFeature;
    return buildQueryModel({
      collection: target.collection,
      queryKey: target.queryKey,
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
      locationFeature,
    });
  }, [
    target, instancesHref, selectedFormat, selectedParameters,
    datetimeMode, selectedDatetime, startDatetime, endDatetime, filterByTime,
    verticalMode, selectedVertical, startVertical, endVertical,
    customDims, clickedCoords, selectedArea, selectedBbox, bboxAsCoords, radius, radiusUnits, queryParams, selectedFeature,
  ]);

  // Publish the request URL and what the query is still missing, adding the API docs' view once
  // the service's API definition is loaded
  useEffect(() => {
    let url: string | null = null;
    let issues: QueryIssue[] = [];
    if (queryModel) {
      url = buildQueryUrl(queryModel);
      if (url) issues = validateQuery(queryModel);
    } else if (instancesHref) {
      ({ url, issues } = instanceStep(instancesHref, selectedInstance));
    }
    if (!url) {
      setQueryValidation(null);
      return;
    }
    setCollectionUrl(url);
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
  }, [queryModel, instancesHref, selectedInstance, apiIndex, setCollectionUrl, setQueryValidation]);

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
    instances, selectedInstance, selectInstance,
    instanceQueryKey, selectInstanceQuery,
    resetQueryState,
    getEffectiveOutputFormats,
    selectDataQuery,
  };
}
