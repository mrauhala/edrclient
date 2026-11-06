import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { executeLocationQuery, getLocationQueryUrl, hasLocationQuery } from '../DataRetrievalAPI';
import { extentsOf, geoJsonLinksOf, queryBaseUrlOf, withLocationsValidation, withoutLocationsValidation } from '../collections/openingCollection';
import type { Collection } from '../types/api';
import { detectEdrVersion, validateLocationsResponse } from '../validation/locationsValidator';
import { useApi } from './ApiContext';
import { useCollection } from './CollectionContext';
import { useGeoJsonLayers } from './GeoJsonLayerContext';
import { useMapInteraction } from './MapInteractionContext';
import { useQueryBuilder } from './QueryBuilderContext';
import { useService } from './ServiceContext';
import { useValidation } from './ValidationContext';

interface OpenCollectionContextValue {
  // Opening the open one again does nothing. Resolves once its locations are in, which a request being
  // opened waits for. The collection itself, not its ID: an API under test can repeat or leave those out
  openCollection: (collection: Collection) => Promise<void>;
  closeCollection: () => void;
}

const OpenCollectionContext = createContext<OpenCollectionContextValue | null>(null);

// Opening and closing a collection, for everything that can: the list, a link, the palette, the keyboard
export function OpenCollectionProvider({ children }: { children: ReactNode }) {
  const { selectedCollection, setSelectedCollection, setSelectedFeature, setCollectionUrl, setSelectedCollectionExtents, setLocationFeatures } = useCollection();
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { setClickedCoords, setDataQuery } = useMapInteraction();
  const { getAuthCredentials } = useService();
  const { apiUrl, conformsTo } = useApi();
  const { setValidationResult, setEndpointUrls, setRawResponses } = useValidation();
  const { selectedDatetime, datetimeMode, startDatetime, endDatetime, resetQueryState } = useQueryBuilder();

  // What's open by now, for a response that arrives after the app has moved on. Also follows a new API
  // being loaded, which closes it without coming through here.
  const openRef = useRef<Collection | null>(selectedCollection);
  useEffect(() => {
    openRef.current = selectedCollection;
  }, [selectedCollection]);

  // Its locations and what they were found to be are only the open collection's
  const clearLocations = useCallback(() => {
    setLocationFeatures(null);
    setValidationResult(withoutLocationsValidation);
    setEndpointUrls(prev => ({ ...prev, locations: undefined }));
    setRawResponses(prev => ({ ...prev, locations: undefined }));
  }, [setLocationFeatures, setValidationResult, setEndpointUrls, setRawResponses]);

  const openCollection = useCallback(async (collection: Collection) => {
    if (openRef.current === collection) return;
    openRef.current = collection;

    setSelectedCollection(collection);
    setSelectedFeature(null);
    const auth = getAuthCredentials(apiUrl);
    setGeoJsonLayers(geoJsonLinksOf(collection, { datetime: selectedDatetime, mode: datetimeMode, start: startDatetime, end: endDatetime }).map(link => ({
      url: link.url,
      title: link.title,
      visible: false,
      apiKey: auth?.apiKey,
      apiKeyParam: auth?.apiKeyParam,
    })));
    setCollectionUrl(queryBaseUrlOf(collection, apiUrl));
    resetQueryState();
    setClickedCoords([]);
    setDataQuery('');
    setSelectedCollectionExtents(extentsOf(collection));
    clearLocations();

    const locationsUrl = hasLocationQuery(collection) ? getLocationQueryUrl(collection) : null;
    if (!locationsUrl) return;
    try {
      const locations = await executeLocationQuery(locationsUrl, auth);
      if (openRef.current !== collection || !locations?.features) return;
      setLocationFeatures(locations.features);

      // Doesn't hold anything up
      const edrVersion = detectEdrVersion(conformsTo);
      if (edrVersion) {
        validateLocationsResponse(locations, edrVersion).then(validation => {
          if (openRef.current !== collection) return;
          setValidationResult(prev => withLocationsValidation(prev, validation, edrVersion));
          setEndpointUrls(prev => ({ ...prev, locations: locationsUrl }));
          setRawResponses(prev => ({ ...prev, locations }));
        });
      }
    } catch (error) {
      console.error('Error executing location query:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, conformsTo, selectedDatetime, datetimeMode, startDatetime, endDatetime]);

  const closeCollection = useCallback(() => {
    openRef.current = null;
    setSelectedCollection(null);
    setSelectedFeature(null);
    setGeoJsonLayers([]);
    setCollectionUrl('');
    resetQueryState();
    setClickedCoords([]);
    // The map's prompts and drawing tools follow this, and with nothing open there's nothing to draw for
    setDataQuery('');
    setSelectedCollectionExtents(null);
    clearLocations();
  }, [setSelectedCollection, setSelectedFeature, setGeoJsonLayers, setCollectionUrl, resetQueryState, setClickedCoords, setDataQuery, setSelectedCollectionExtents, clearLocations]);

  // The layers follow the time chosen
  useEffect(() => {
    if (!selectedCollection || geoJsonLayers.length === 0) return;
    const auth = getAuthCredentials(apiUrl);
    setGeoJsonLayers(geoJsonLinksOf(selectedCollection, { datetime: selectedDatetime, mode: datetimeMode, start: startDatetime, end: endDatetime }).map((link, index) => {
      const existing = geoJsonLayers[index];
      return {
        url: link.url,
        title: link.title,
        visible: existing?.visible ?? false,
        labelProperty: existing?.labelProperty,
        data: existing?.data,
        apiKey: auth?.apiKey,
        apiKeyParam: auth?.apiKeyParam,
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatetime, datetimeMode, startDatetime, endDatetime]);

  const value = useMemo(() => ({ openCollection, closeCollection }), [openCollection, closeCollection]);
  return <OpenCollectionContext.Provider value={value}>{children}</OpenCollectionContext.Provider>;
}

export function useOpenCollection() {
  const context = useContext(OpenCollectionContext);
  if (!context) throw new Error('useOpenCollection must be used within an OpenCollectionProvider');
  return context;
}
