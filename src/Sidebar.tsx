import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
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

interface SidebarProps {
  open: boolean;
}

const Sidebar = ({ open }: SidebarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sidebarWidth = isMobile ? '100%' : 480;
  const { setGeoJsonLayers } = useGeoJsonLayers();
  const { setClickedCoords, setDataQuery } = useMapInteraction();
  const { collections, setCollections, setSelectedCollection, setSelectedCollectionExtents, setLocationFeatures, setLandingPageLicense, setCollectionUrl } = useCollection();
  const { setLandingPageTitle, setActiveServiceUrl } = useService();
  const queryState = useQueryUrl();
  const { resetQueryState } = queryState;
  const { validationResult, setValidationResult, setEndpointUrls, setRawResponses } = useValidation();

  const [currentApiUrl, setCurrentApiUrl] = useState('https://opendata.fmi.fi/edr');
  const [isLoading, setIsLoading] = useState(false);
  const [landingPageDescription, setLandingPageDescription] = useState<string | null>(null);
  const [serviceDescUrl, setServiceDescUrl] = useState<string | null>(null);
  const [conformsTo, setConformsTo] = useState<string[] | null>(null);
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
  }, [setCollections, resetQueryState, setCollectionUrl, setGeoJsonLayers, setSelectedCollection, setSelectedCollectionExtents, setLocationFeatures, setClickedCoords, setDataQuery, setValidationResult, setEndpointUrls, setRawResponses, setLandingPageTitle]);

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
  }, [setCollections, setValidationResult, setEndpointUrls, setRawResponses, setLandingPageTitle]);

  const handleLoadError = useCallback((error: Error) => {
    setCollections([]);
    setValidationResult({
      isValid: false,
      errors: [{ message: error.message }]
    });
  }, [setCollections, setValidationResult]);

  return (
    <Box
      sx={{
        width: open ? sidebarWidth : 0,
        flexShrink: 0,
        transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1) 0ms',
        overflow: 'hidden',
        height: '100%',
        position: isMobile ? 'absolute' : 'relative',
        zIndex: isMobile ? 1100 : 'auto',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          minWidth: isMobile ? '100vw' : 480,
          width: sidebarWidth,
          height: '100%',
          overflowY: 'scroll',
          overflowX: 'hidden',
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
          serviceDescUrl={serviceDescUrl}
          setServiceDescUrl={setServiceDescUrl}
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
