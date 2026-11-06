import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiOfRequest, licenseOf, loadedApiOf, NOTHING_LOADED, startingApiUrl, type LoadedApi } from '../api/loadedApi';
import type { LicenseInfo } from '../CollectionInfo';
import systemServices from '../config/services.json';
import { getCollections } from '../DataRetrievalAPI';
import { ServiceType, type ServiceDefinition } from '../types/ServiceType';
import { forgetServiceDescription } from '../validation/openapi/loadServiceDescription';
import { useCollection } from './CollectionContext';
import { useGeoJsonLayers } from './GeoJsonLayerContext';
import { useMapInteraction } from './MapInteractionContext';
import { useQueryBuilder } from './QueryBuilderContext';
import { useService } from './ServiceContext';
import { useValidation } from './ValidationContext';

const typedSystemServices = systemServices as ServiceDefinition[];

const DEFAULT_API_URL = typedSystemServices.find(service => service.type === ServiceType.EDR && service.label === 'FMI Open Data')?.url
  ?? typedSystemServices[0]?.url
  ?? '';

interface ApiContextValue extends LoadedApi {
  apiUrl: string;
  // Done whichever way it went: what went wrong is in the validation result
  status: 'loading' | 'done';
  license: LicenseInfo | null;
  // Asking for the API that's loaded already leaves it as it is
  loadApi: (url: string) => void;
  loadApiOf: (requestUrl: string) => void;
  reloadApi: () => void;
}

const ApiContext = createContext<ApiContextValue | null>(null);

// The API being looked at, for everything that can change it: the form, a link, the palette, settings
export function ApiProvider({ children }: { children: ReactNode }) {
  const { setCollections, setSelectedCollection, setSelectedFeature, setCollectionUrl, setSelectedCollectionExtents, setLocationFeatures } = useCollection();
  const { customServices, getAuthCredentials, serviceDescUrl, setServiceDescUrl } = useService();
  const { setGeoJsonLayers } = useGeoJsonLayers();
  const { setClickedCoords, setDataQuery } = useMapInteraction();
  const { setValidationResult, setEndpointUrls, setRawResponses } = useValidation();
  const { resetQueryState } = useQueryBuilder();
  const serviceUrls = useMemo(() => [...typedSystemServices, ...customServices].map(service => service.url), [customServices]);

  // A new object per load, so that the same URL can be loaded again
  const [request, setRequest] = useState(() => ({ url: startingApiUrl(window.location.hash, serviceUrls, DEFAULT_API_URL) }));
  // Loading from the first render and from the moment it's asked for, not from when the effect below
  // gets to it. A request being opened waits on this, and a parent's effects run after its children's,
  // so it would see the previous API's "done" and carry on too early.
  const [status, setStatus] = useState<ApiContextValue['status']>('loading');
  const [loaded, setLoaded] = useState<LoadedApi>(NOTHING_LOADED);

  // Nothing of the previous API lasts. It's all empty to begin with, so the first load doesn't need this.
  const clearApi = useCallback(() => {
    setStatus('loading');
    setLoaded(NOTHING_LOADED);
    setServiceDescUrl(null);
    setCollections([]);
    setSelectedCollection(null);
    setSelectedFeature(null);
    resetQueryState();
    setCollectionUrl('');
    setGeoJsonLayers([]);
    setValidationResult({ isValid: true, errors: null });
    setEndpointUrls({});
    setRawResponses({});
    setSelectedCollectionExtents(null);
    setLocationFeatures(null);
    setClickedCoords([]);
    setDataQuery('');
  }, [setServiceDescUrl, setCollections, setSelectedCollection, setSelectedFeature, resetQueryState, setCollectionUrl, setGeoJsonLayers, setValidationResult, setEndpointUrls, setRawResponses, setSelectedCollectionExtents, setLocationFeatures, setClickedCoords, setDataQuery]);

  const loadApi = useCallback((url: string) => {
    if (url === request.url) return;
    clearApi();
    setRequest({ url });
  }, [request.url, clearApi]);

  const loadApiOf = useCallback((requestUrl: string) => loadApi(apiOfRequest(requestUrl, serviceUrls)), [loadApi, serviceUrls]);

  const reloadApi = useCallback(() => {
    // Or it would check the document as it was, however it's changed since
    if (serviceDescUrl) forgetServiceDescription(serviceDescUrl);
    clearApi();
    setRequest({ url: request.url });
  }, [request.url, clearApi, serviceDescUrl]);

  // In an effect, not in loadApi, for the credentials: settings add a service and select it in one go
  useEffect(() => {
    const controller = new AbortController();
    const { url } = request;

    async function load() {
      try {
        const result = await getCollections(url, getAuthCredentials(url), controller.signal);
        if (controller.signal.aborted) return;
        setCollections(result.collections || []);
        setValidationResult(result.validation);
        setEndpointUrls({
          landingPage: result.landingPageUrl,
          collections: result.collectionsUrl,
          conformance: result.conformanceUrl,
        });
        setRawResponses(result.rawResponses || {});
        setServiceDescUrl(result.serviceDescUrl || null);
        setLoaded(loadedApiOf(result));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Error loading collections:', error);
        setCollections([]);
        setValidationResult({
          isValid: false,
          errors: [{ message: error instanceof Error ? error.message : 'Unknown error loading collections' }],
        });
      }
      setStatus('done');
    }

    load();
    return () => controller.abort();
    // Only for a new load: credentials change as services are edited
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const license = useMemo(() => licenseOf(loaded), [loaded]);
  const value = useMemo(() => ({ ...loaded, apiUrl: request.url, status, license, loadApi, loadApiOf, reloadApi }), [loaded, request.url, status, license, loadApi, loadApiOf, reloadApi]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used within an ApiProvider');
  return context;
}
