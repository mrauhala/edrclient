import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { GetCollectionsResult, Link as ApiLink } from './DataRetrievalAPI';
import { useValidation } from './contexts/ValidationContext';
import { parseLicense, LicenseInfo } from './CollectionInfo';
import ServiceInfoPanel from './ServiceInfoPanel';
import ServiceSelector from './ServiceSelector';
import CollectionsList from './CollectionsList';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { useMapInteraction } from './contexts/MapInteractionContext';
import { useCollection } from './contexts/CollectionContext';
import { useService } from './contexts/ServiceContext';
import { useQueryUrl } from './hooks/useQueryUrl';
import { usePanes } from './contexts/PanesContext';
import { REQUEST_WIDTH } from './panes';

const Sidebar = () => {
  const { isOpen, isMobile } = usePanes();
  const open = isOpen.request;
  // Alone it takes the room, since nothing else is showing
  const sidebarWidth = isMobile || (!isOpen.map && !isOpen.response) ? '100%' : REQUEST_WIDTH;
  const { setGeoJsonLayers } = useGeoJsonLayers();
  const { setClickedCoords, setDataQuery } = useMapInteraction();
  const { collections, setCollections, setSelectedCollection, setSelectedFeature, setSelectedCollectionExtents, setLocationFeatures, setLandingPageLicense, setCollectionUrl } = useCollection();
  const { setLandingPageTitle, setActiveServiceUrl, conformsTo, setConformsTo } = useService();
  const queryState = useQueryUrl();
  const { resetQueryState } = queryState;
  const { validationResult, setValidationResult, setEndpointUrls, setRawResponses } = useValidation();

  const [currentApiUrl, setCurrentApiUrl] = useState('https://opendata.fmi.fi/edr');
  const [isLoading, setIsLoading] = useState(false);
  const [landingPageDescription, setLandingPageDescription] = useState<string | null>(null);
  const [landingPageLinks, setLandingPageLinks] = useState<ApiLink[] | null>(null);
  const [landingPageKeywords, setLandingPageKeywords] = useState<string[] | null>(null);
  const [collectionsLinks, setCollectionsLinks] = useState<ApiLink[] | null>(null);
  const [selectedConformanceUrl, setSelectedConformanceUrl] = useState<string | null>(null);

  // Derive top-level service license
  const topLevelLicense = useMemo<LicenseInfo | null>(() => {
    for (const links of [collectionsLinks, landingPageLinks]) {
      if (!links) continue;
      const link = links.find((l) => l.rel === 'license');
      if (link) return parseLicense(link.href, link.title);
    }
    return null;
  }, [collectionsLinks, landingPageLinks]);

  // Sync top-level service license to context
  useEffect(() => {
    setLandingPageLicense(topLevelLicense);
  }, [topLevelLicense, setLandingPageLicense]);

  // Callbacks for ServiceSelector
  const handleBeforeLoad = useCallback(() => {
    setCollections([]);
    setSelectedCollection(null);
    setSelectedFeature(null);
    resetQueryState();
    setCollectionUrl('');
    setGeoJsonLayers([]);
    setValidationResult({ isValid: true, errors: null });
    setEndpointUrls({});
    setRawResponses({});
    setConformsTo(null);
    setLandingPageLinks(null);
    setCollectionsLinks(null);
    setLandingPageTitle(null);
    setLandingPageDescription(null);
    setLandingPageKeywords(null);
    setSelectedCollectionExtents(null);
    setLocationFeatures(null);
    setClickedCoords([]);
    setDataQuery('');
  }, [setCollections, resetQueryState, setCollectionUrl, setGeoJsonLayers, setSelectedCollection, setSelectedFeature, setSelectedCollectionExtents, setLocationFeatures, setClickedCoords, setDataQuery, setValidationResult, setEndpointUrls, setRawResponses, setLandingPageTitle, setConformsTo]);

  const handleLoadResult = useCallback((result: GetCollectionsResult) => {
    setCollections(result.collections || []);
    setValidationResult(result.validation);
    setEndpointUrls({
      landingPage: result.landingPageUrl,
      collections: result.collectionsUrl,
      conformance: result.conformanceUrl,
    });
    setRawResponses(result.rawResponses || {});
    setLandingPageTitle(result.landingPageTitle || null);
    setLandingPageDescription(result.landingPageDescription || null);
    setConformsTo(result.conformsTo || null);
    setLandingPageLinks(result.landingPageLinks || null);
    setCollectionsLinks(result.collectionsLinks || null);
    setLandingPageKeywords(result.landingPageKeywords || null);
  }, [setCollections, setValidationResult, setEndpointUrls, setRawResponses, setLandingPageTitle, setConformsTo]);

  const handleLoadError = useCallback((error: Error) => {
    setCollections([]);
    setValidationResult({
      isValid: false,
      errors: [{ message: error.message }]
    });
  }, [setCollections, setValidationResult]);

  return (
    <Box
      id="sidebar"
      sx={{
        width: open ? sidebarWidth : 0,
        flexShrink: 0,
        // Hidden once closed, so its controls leave the tab order; it stays mounted to keep its state
        visibility: open ? 'visible' : 'hidden',
        transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1) 0ms, visibility 225ms',
        overflow: 'hidden',
        height: '100%',
        // On phones it covers the map, within the row between the bars
        ...(isMobile ? { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 1100 } : { position: 'relative' }),
      }}
    >
      <Paper
        elevation={3}
        sx={{
          minWidth: isMobile ? '100vw' : REQUEST_WIDTH,
          width: sidebarWidth,
          height: '100%',
          overflowY: 'scroll',
          overflowX: 'hidden',
          // Scrolling past either end doesn't carry on to the page
          overscrollBehavior: 'contain',
          // Clear of a notch in landscape: on the left, and on phones, where it's full width, on the right
          pl: 'var(--safe-left)',
          pr: isMobile ? 'var(--safe-right)' : 0,
          borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        }}
        className="sidebar-scrollable"
      >
        <ServiceSelector
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          onBeforeLoad={handleBeforeLoad}
          onLoadResult={handleLoadResult}
          onLoadError={handleLoadError}
          onApiUrlChange={(url: string) => { setCurrentApiUrl(url); setActiveServiceUrl(url); }}
          selectedConformanceUrl={selectedConformanceUrl}
          setSelectedConformanceUrl={setSelectedConformanceUrl}
        />

        <ServiceInfoPanel
          landingPageDescription={landingPageDescription}
          landingPageKeywords={landingPageKeywords}
          conformsTo={conformsTo}
          landingPageLinks={landingPageLinks}
          validationResult={validationResult}
          onConformanceClick={setSelectedConformanceUrl}
        />

        <CollectionsList
          collections={collections}
          validationResult={validationResult}
          topLevelLicense={topLevelLicense}
          isLoading={isLoading}
          currentApiUrl={currentApiUrl}
          queryState={queryState}
        />
      </Paper>
    </Box>
  );
};

export default Sidebar;
