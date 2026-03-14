import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useEffect, useState, useMemo } from 'react';
import { Collection, ValidationResult, GetCollectionsResult, normalizeBbox, hasLocationQuery, getLocationQueryUrl, executeLocationQuery, Link as ApiLink, normalizeHref } from './DataRetrievalAPI';
import CollectionInfo, { parseLicense, LicenseInfo } from './CollectionInfo';
import LocationFeatureList from './LocationFeatureList';
import ServiceInfoPanel from './ServiceInfoPanel';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';
import CollectionValidationErrors from './CollectionValidationErrors';
import ItemsTable from './ItemsTable';
import ServiceSelector from './ServiceSelector';
import CollectionQueryBuilder from './CollectionQueryBuilder';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // Mobile/tablet breakpoint at 900px
  const sidebarWidth = isMobile ? '100%' : 480;
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { setClickedCoords, setDataQuery } = useMapInteraction();
  const { selectedCollection, setSelectedCollection, setSelectedCollectionExtents, locationFeatures, setLocationFeatures, setSelectedFeature, setLandingPageLicense, setCollectionUrl } = useCollection();
  const { getAuthCredentials } = useService();
  const queryState = useQueryUrl();
  const {
    selectedDatetime,
    datetimeMode,
    startDatetime,
    endDatetime,
    resetQueryState,
    buildUrlWithParams,
  } = queryState;

  const [currentApiUrl, setCurrentApiUrl] = useState('https://opendata.fmi.fi/edr');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true, errors: null });
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocationCollection, setCurrentLocationCollection] = useState<string | null>(null);
  const [landingPageTitle, setLandingPageTitle] = useState<string | null>(null);
  const [landingPageDescription, setLandingPageDescription] = useState<string | null>(null);
  const [serviceDescUrl, setServiceDescUrl] = useState<string | null>(null);
  const [conformsTo, setConformsTo] = useState<string[] | null>(null);
  const [landingPageLinks, setLandingPageLinks] = useState<ApiLink[] | null>(null);
  const [landingPageKeywords, setLandingPageKeywords] = useState<string[] | null>(null);
  const [collectionsLinks, setCollectionsLinks] = useState<ApiLink[] | null>(null);

  // Derive top-level service license (EDR spec: license applies to all collections unless
  // a collection overrides it with its own license link).
  // Priority: /collections root links → landing page links (either may carry the license).
  const topLevelLicense = useMemo<LicenseInfo | null>(() => {
    for (const links of [collectionsLinks, landingPageLinks]) {
      if (!links) continue;
      const link = links.find((l) => l.rel === 'license');
      if (link) return parseLicense(link.href, link.title);
    }
    return null;
  }, [collectionsLinks, landingPageLinks]);

  const [selectedConformanceUrl, setSelectedConformanceUrl] = useState<string | null>(null);
  // Query states are now managed via useQueryUrl hook
  const [showCollectionValidation, setShowCollectionValidation] = useState<{[key: string]: boolean}>({});

  // Helper function to extract GeoJSON links from a collection
  const getGeoJsonLinks = (
    collection: Collection, 
    datetime?: string,
    mode?: 'individual' | 'range',
    startDt?: string,
    endDt?: string
  ): {url: string, title: string}[] => {
    if (!collection || !collection.links || !Array.isArray(collection.links)) {
      return [];
    }
    
    // Check if collection has temporal extent
    const hasTemporal = collection.extent?.temporal && 
                        (collection.extent.temporal.interval || collection.extent.temporal.values);
    
    return collection.links
      .filter(link => link.type === 'application/geo+json')
      .map(link => {
        const normalizedHref = normalizeHref(link.href);
        if (!normalizedHref) return null; // Skip invalid links
        
        let url = normalizedHref;
        
        // NOTE: Do NOT add bbox here - OpenLayers will handle it dynamically with bboxStrategy
        
        // Add datetime parameter if collection has temporal extent AND user has selected a datetime
        if (hasTemporal) {
          let datetimeParam = '';
          
          if (mode === 'range' && startDt && endDt) {
            // Range mode: use start/end datetime
            datetimeParam = `${startDt}/${endDt}`;
          } else if (datetime) {
            // Individual mode: use selected datetime
            datetimeParam = datetime;
          }
          // If no datetime is selected, don't add the parameter at all
          
          if (datetimeParam) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}datetime=${datetimeParam}`;
          }
        }
        
        return {
          url: url,
          title: link.title || link.rel || 'GeoJSON Layer'
        };
      })
      .filter(item => item !== null) as {url: string, title: string}[];
  };

  const [openCollectionIndex, setOpenCollectionIndex] = useState<number | null>(null);

  // Callbacks for ServiceSelector
  const handleBeforeLoad = () => {
    setCollections([]);
    setOpenCollectionIndex(null);
    setSelectedCollection(null);
    resetQueryState();
    setCollectionUrl('');
    setGeoJsonLayers([]);
    setValidationResult({ isValid: true, errors: null });
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
  };

  const handleLoadResult = (result: GetCollectionsResult) => {
    setCollections(result.collections || []);
    setValidationResult(result.validation);
    setLandingPageTitle(result.landingPageTitle || null);
    setLandingPageDescription(result.landingPageDescription || null);
    setConformsTo(result.conformsTo || null);
    setLandingPageLinks(result.landingPageLinks || null);
    setCollectionsLinks(result.collectionsLinks || null);
    setLandingPageKeywords(result.landingPageKeywords || null);
  };

  const handleLoadError = (error: Error) => {
    setCollections([]);
    setValidationResult({
      isValid: false,
      errors: [{ message: error.message }]
    });
  };

  // Sync top-level service license to context (so Map can show it as fallback).
  useEffect(() => {
    setLandingPageLicense(topLevelLicense);
  }, [topLevelLicense, setLandingPageLicense]);

  // Effect to update GeoJSON layers when datetime values change
  useEffect(() => {
    if (selectedCollection && geoJsonLayers.length > 0) {
      const geoJsonLinks = getGeoJsonLinks(selectedCollection, selectedDatetime, datetimeMode, startDatetime, endDatetime);
      const auth = getAuthCredentials(currentApiUrl);
      const updatedLayers = geoJsonLinks.map((link, index) => {
        // Preserve the visibility state and other properties from existing layers
        const existingLayer = geoJsonLayers[index];
        return {
          url: link.url,
          title: link.title,
          visible: existingLayer?.visible ?? false,
          labelProperty: existingLayer?.labelProperty,
          data: existingLayer?.data,
          apiKey: auth?.apiKey,
          apiKeyParam: auth?.apiKeyParam
        };
      });
      setGeoJsonLayers(updatedLayers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatetime, datetimeMode, startDatetime, endDatetime]);

  const handleItemClick = async (index: number, key: string) => {
    // Toggle collection: close if already open, open if closed (and close others)
    const newIndex = openCollectionIndex === index ? null : index;
    setOpenCollectionIndex(newIndex);
    
    // Find the collection and trigger extent change
    const collection = collections[index];
    
    // Update local state for selected collection
    const selectedColl = newIndex !== null ? collection : null;
    setSelectedCollection(selectedColl);
    
    // Initialize GeoJSON layers for the selected collection
    if (selectedColl) {
      const geoJsonLinks = getGeoJsonLinks(selectedColl, selectedDatetime, datetimeMode, startDatetime, endDatetime);
      const auth = getAuthCredentials(currentApiUrl);
      const initialLayers = geoJsonLinks.map(link => ({
        url: link.url,
        title: link.title,
        visible: false, // Initially hidden
        apiKey: auth?.apiKey,
        apiKeyParam: auth?.apiKeyParam
      }));
      setGeoJsonLayers(initialLayers);
    } else {
      // Clear GeoJSON layers when collection is closed
      setGeoJsonLayers([]);
    }
    
    // Find the "data" link from collection links
    if (selectedColl) {
      const dataLink = selectedColl.links.find(link => link.rel === 'data');
      let baseUrl = '';
      if (dataLink?.href) {
        const normalizedHref = normalizeHref(dataLink.href);
        if (normalizedHref) {
          baseUrl = normalizedHref;
        }
      }
      
      if (!baseUrl) {
        // Fallback to constructed URL if no data link found
        baseUrl = currentApiUrl + "/collections/" + key;
      }
      // Collection URL - no query params added (isDataQuery = false)
      setCollectionUrl(buildUrlWithParams(baseUrl, '', [], false));
      resetQueryState();
      setClickedCoords([]); // Clear clicked coordinates when collection changes
      setDataQuery(''); // Clear data query when collection changes
    } else {
      setCollectionUrl('');
      resetQueryState();
      setClickedCoords([]); // Clear clicked coordinates
    }
    
    // Update context with selected collection
    setSelectedCollection(selectedColl);
    
    // Only show extent and location data if collection is being opened
    if (newIndex !== null) {
      // Collection is being opened - show extent and location data
      // Safely check for bbox existence with proper validation
      if (collection && 
          collection.extent && 
          typeof collection.extent === 'object' &&
          collection.extent.spatial && 
          typeof collection.extent.spatial === 'object' &&
          collection.extent.spatial.bbox && 
          Array.isArray(collection.extent.spatial.bbox) &&
          collection.extent.spatial.bbox.length > 0) {
        
        try {
          const normalizedBboxes = normalizeBbox(collection.extent.spatial.bbox);
          if (normalizedBboxes) {
            setSelectedCollectionExtents(normalizedBboxes);
          } else {
            // normalizeBbox returned null, clear extent
            setSelectedCollectionExtents(null);
          }
        } catch (error) {
          console.warn('Error normalizing bbox:', error);
          setSelectedCollectionExtents(null);
        }
      } else {
        // Clear extent if collection doesn't have valid bbox
        setSelectedCollectionExtents(null);
      }
      
      // Check for location query support and execute if available
      if (collection && hasLocationQuery(collection)) {
        const locationQueryUrl = getLocationQueryUrl(collection);
        
        if (locationQueryUrl) {
          try {
            const locationResult = await executeLocationQuery(locationQueryUrl, getAuthCredentials(currentApiUrl));
            if (locationResult && locationResult.features) {
              setLocationFeatures(locationResult.features);
              setCurrentLocationCollection(collection.id); // Track which collection has location features
            } else {
              setLocationFeatures(null);
              setCurrentLocationCollection(null);
            }
          } catch (error) {
            console.error('Error executing location query:', error);
            setLocationFeatures(null);
            setCurrentLocationCollection(null);
          }
        }
      } else {
        // Clear location features if collection doesn't support location queries
        setLocationFeatures(null);
        setCurrentLocationCollection(null);
      }
    } else {
      // Collection is being closed - clear all map data
      console.log('Collection being closed, clearing map data');
      setSelectedCollectionExtents(null);
      setLocationFeatures(null);
      setCurrentLocationCollection(null);
      // Clear GeoJSON layers when collection is closed
      setGeoJsonLayers([]);
    }
  };



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
          onApiUrlChange={setCurrentApiUrl}
          selectedConformanceUrl={selectedConformanceUrl}
          setSelectedConformanceUrl={setSelectedConformanceUrl}
          landingPageTitle={landingPageTitle}
          serviceDescUrl={serviceDescUrl}
          setServiceDescUrl={setServiceDescUrl}
        />
      
      <ServiceInfoPanel
        landingPageTitle={landingPageTitle}
        landingPageDescription={landingPageDescription}
        landingPageKeywords={landingPageKeywords}
        conformsTo={conformsTo}
        landingPageLinks={landingPageLinks}
        validationResult={validationResult}
        onConformanceClick={setSelectedConformanceUrl}
      />
      
      <List component="nav">
        {isLoading ? (
          <Alert severity="info">Loading collections...</Alert>
        ) : (
          <>
            {/* Show fatal errors (landing page or collections failed) */}
            {collections.length === 0 && validationResult.errors && validationResult.errors.length > 0 && validationResult.errors.some(err => err.section !== 'conformance' && err.section !== 'data link') ? (
              validationResult.errors.filter(err => err.section !== 'conformance' && err.section !== 'data link').map((error, index) => (
                <Alert
                  key={index}
                  severity={error.type === 'cors' ? 'warning' : 'error'}
                >
                  <AlertTitle>
                    {error.title ?? (error.type === 'cors' ? 'CORS Issue' : 'Error')}
                  </AlertTitle>
                  {error.message}
                  {error.type === 'cors' && (
                    <div style={{ marginTop: '8px', fontSize: '0.875rem' }}>
                      <strong>Possible solutions:</strong>
                      <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                        <li>Use a CORS proxy service</li>
                        <li>Contact the service provider to enable CORS headers</li>
                        <li>Access the API from a server-side application instead</li>
                      </ul>
                    </div>
                  )}
                </Alert>
              ))
            ) : collections.length === 0 ? (
              <Alert severity="warning">No collections found from this endpoint.</Alert>
            ) : (
              <Alert severity="success">Found {collections.length} collections</Alert>
            )}
          </>
        )}
        {/* Conformance errors (missing link or failed fetch) — non-fatal but always visible */}
        {!isLoading && validationResult.errors?.some(err => err.section === 'conformance') &&
          validationResult.errors.filter(err => err.section === 'conformance').map((error, index) => (
            <Alert key={`conf-${index}`} severity="error" sx={{ mt: 1 }}>
              <AlertTitle>{error.title ?? 'Conformance Unavailable'}</AlertTitle>
              {error.message}
            </Alert>
          ))
        }
        {/* Data link errors (missing or multiple) — non-fatal but always visible */}
        {!isLoading && validationResult.errors?.some(err => err.section === 'data link') &&
          validationResult.errors.filter(err => err.section === 'data link').map((error, index) => (
            <Alert key={`data-${index}`} severity="error" sx={{ mt: 1 }}>
              <AlertTitle>{error.title ?? 'Collections Link Issue'}</AlertTitle>
              {error.message}
            </Alert>
          ))
        }
            {collections.map((collection, index) => (
          <React.Fragment key={collection.id || index}>
            <ListItemButton
              onClick={() => handleItemClick(index, collection.id)}
              sx={{
                borderLeft: '3px solid',
                borderColor: !validationResult.collectionErrors
                  ? 'transparent'
                  : validationResult.collectionErrors[collection.id]
                    ? 'warning.main'
                    : 'success.main',
                pl: '13px',
              }}
            >
              <ListItemText
                primary={
                  <CollectionInfo
                    collection={collection}
                    fallbackLicense={topLevelLicense}
                    validationErrors={
                      validationResult.collectionErrors
                        ? (validationResult.collectionErrors[collection.id] ?? [])
                        : undefined
                    }
                  />
                }
                primaryTypographyProps={{ component: 'div' }}
              />
              {openCollectionIndex === index ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={openCollectionIndex === index} timeout="auto" unmountOnExit>
              {/* Dropdowns Section - Always Visible */}
              <Box sx={{ p: 2 }}>
                <CollectionQueryBuilder collection={collection} queryState={queryState} />


                {/* Items Table for collections with items links */}
                {collection.links && collection.links.some(link => link.rel === 'items' && link.type?.includes('geo+json')) && (
                  <Box sx={{ mb: 2 }}>
                    {collection.links.map((link, idx) => {
                      if (link.rel === 'items' && link.type?.includes('geo+json')) {
                        const normalizedHref = normalizeHref(link.href);
                        if (!normalizedHref) return null;
                        
                        // Handler for when a feature/item is clicked in the table
                        const handleItemFeatureClick = (feature: any) => {
                          // Create a GeoJSON layer for the clicked feature
                          const featureName = feature.properties?.name || feature.properties?.title || `Feature ${feature.id || ''}`;
                          const featureLayer = {
                            url: `selected-item-${Date.now()}`, // Unique URL to force re-render
                            title: `Selected: ${featureName}`,
                            visible: true,
                            data: {
                              type: 'FeatureCollection',
                              features: [feature]
                            }
                          };
                          
                          // Find existing layers that are not selected items (keep original layers)
                          const nonSelectedLayers = geoJsonLayers.filter(l => !l.title.startsWith('Selected: '));
                          
                          // Always add the new selected feature (replacing any previous selection)
                          const updatedLayers = [...nonSelectedLayers, featureLayer];
                          
                          setGeoJsonLayers(updatedLayers);
                        };
                        
                        return (
                          <ItemsTable
                            key={idx}
                            url={normalizedHref}
                            title={link.title || 'Items'}
                            onFeatureClick={handleItemFeatureClick}
                          />
                        );
                      }
                      return null;
                    })}
                  </Box>
                )}

                {/* Location Query Info */}
                {hasLocationQuery(collection) && (
                  <>
                    {/* Show location features list only for the current collection */}
                    {currentLocationCollection === collection.id && locationFeatures && (
                      <Box sx={{ mt: 1 }}>
                        <LocationFeatureList 
                          features={locationFeatures} 
                          onFeatureSelect={setSelectedFeature}
                        />
                      </Box>
                    )}
                  </>
                )}

                {/* Show Validation Button */}
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setShowCollectionValidation({
                    ...showCollectionValidation,
                    [collection.id]: !showCollectionValidation[collection.id]
                  })}
                  endIcon={showCollectionValidation[collection.id] ? <ExpandLess /> : <ExpandMore />}
                  sx={{ mt: 2 }}
                >
                  {showCollectionValidation[collection.id] ? 'Hide Validation' : 'Show Validation'}
                </Button>
              </Box>

              {/* Validation Section - Collapsible */}
              <Collapse in={showCollectionValidation[collection.id]} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2 }}>
              {/* Schema validation errors for this collection */}
              {validationResult.collectionErrors && validationResult.collectionErrors[collection.id] && (
                <CollectionValidationErrors 
                  collectionId={collection.id}
                  errors={validationResult.collectionErrors[collection.id]}
                  expanded={false}
                />
              )}

              {typeof collection.id == "undefined" 
                ? <Alert severity="error"><AlertTitle>A: ID</AlertTitle>"Every Collection within a collections array MUST have a unique (within the array) id parameter.</Alert>
                : <Alert severity="success"><AlertTitle>A: ID</AlertTitle>{collection.id}</Alert>
              }

              {/* Rest of your existing collection properties alerts */}
              { typeof collection.title == "undefined" 
                ? <Alert severity="warning"><AlertTitle>B: TITLE</AlertTitle>Every Collection within a collections array SHOULD have a title parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>B: TITLE</AlertTitle>{collection.title}</Alert>
              }

              { typeof collection.description == "undefined" 
                ? <Alert severity="warning"><AlertTitle>C: DESCRIPTION</AlertTitle>Every Collection within a collections array SHOULD have a description parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>C: DESCRIPTION</AlertTitle>{collection.description}</Alert>
              }

              { typeof collection.keywords == "undefined" 
                ? <Alert severity="warning"><AlertTitle>D: KEYWORDS</AlertTitle>Every Collection within a collections array SHOULD have a keywords parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>D: KEYWORDS</AlertTitle>{collection.keywords.join(', ')}</Alert>
              }

              { typeof collection.links == "undefined" 
                ? <Alert severity="error"><AlertTitle>E: LINKS</AlertTitle>Every Collection within a collections array MUST have a links parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>E: LINKS</AlertTitle>{collection.links.map((link, i) => {
                    const normalizedHref = normalizeHref(link.href);
                    return normalizedHref ? (<div key={i}><Link href={normalizedHref}>{link.title ? link.title : link.rel}</Link> ({link.rel})</div>) : null;
                  })}</Alert>
              }

              { typeof collection.data_queries == "undefined"
                ? <Alert severity="error"><AlertTitle>F: DATA_QUERIES</AlertTitle>Every collection within a collections array MUST have a data_queries parameter.</Alert>
                : (
                  <Alert severity="success">
                    <AlertTitle>F: DATA_QUERIES</AlertTitle>
                    {Object.keys(collection.data_queries).map((key) => {
                      const normalizedHref = normalizeHref(collection.data_queries[key]?.link?.href);
                      return normalizedHref ? (
                        <div key={key}>
                          <Link href={normalizedHref}>
                            {collection.data_queries[key].link.title ? collection.data_queries[key].link.title : collection.data_queries[key].link.rel}
                          </Link> ({collection.data_queries[key].link.rel})
                        </div>
                      ) : null;
                    })}
                  </Alert>
                )
              }
              
              {/* Main Extent Section */}
              {typeof collection.extent !== "undefined" ? (
                <Box sx={{ padding: 0, minWidth: 120 }}>
                  <Alert severity="success">
                    <AlertTitle>G: EXTENT</AlertTitle>
                    Collection extent information with spatial (mandatory), temporal and vertical components (optional).
                  </Alert>
                  
                  {/* Spatial Extent Subsection (Mandatory) */}
                  {collection.extent.spatial && 
                   typeof collection.extent.spatial === 'object' &&
                   collection.extent.spatial.bbox && 
                   Array.isArray(collection.extent.spatial.bbox) &&
                   collection.extent.spatial.bbox.length > 0 && 
                   collection.extent.spatial.crs ? (
                    <Box sx={{ ml: 2, mt: 1 }}>
                      <Alert severity="success">
                        <AlertTitle>G.1: Spatial Extent (Mandatory)</AlertTitle>
                        <strong>CRS:</strong> {collection.extent.spatial.crs}<br/>
                        <strong>Bounding Box{Array.isArray(collection.extent.spatial.bbox[0]) && collection.extent.spatial.bbox.length > 1 ? 'es' : ''}:</strong><br/>
                        {Array.isArray(collection.extent.spatial.bbox[0]) 
                          ? (collection.extent.spatial.bbox as number[][]).map((bbox, idx) => (
                              <div key={idx} style={{ marginLeft: '10px' }}>
                                Bbox {idx + 1}: [{bbox.join(', ')}]
                              </div>
                            ))
                          : <div style={{ marginLeft: '10px' }}>[{(collection.extent.spatial.bbox as number[]).join(', ')}]</div>
                        }
                      </Alert>
                      {!Array.isArray(collection.extent.spatial.bbox[0]) && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          <AlertTitle>Legacy bbox format</AlertTitle>
                          This collection uses a flat array format instead of the EDR standard array-of-bbox-arrays format.
                        </Alert>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ ml: 2, mt: 1 }}>
                      <Alert severity="error">
                        <AlertTitle>G.1: Spatial Extent (Mandatory)</AlertTitle>
                        Missing or invalid spatial extent. Spatial extent with bounding box and CRS is required.
                      </Alert>
                    </Box>
                  )}

                  {/* Temporal Extent Subsection (Optional) */}
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <TemporalExtent 
                      temporal={collection.extent.temporal} 
                      collectionId={collection.id}
                      isSubsection={true}
                    />
                  </Box>

                  {/* Vertical Extent Subsection (Optional) */}
                  {collection.extent?.vertical && (
                    <Box sx={{ ml: 2, mt: 1 }}>
                      <VerticalExtent 
                        vertical={collection.extent.vertical} 
                        collectionId={collection.id}
                        isSubsection={true}
                      />
                    </Box>
                  )}
                </Box>
              ) : (
                <Alert severity="error">
                  <AlertTitle>G: EXTENT</AlertTitle>
                  Every collection within a collections array MUST have an extent parameter.
                </Alert>
              )}

              { typeof collection.crs == "undefined" 
                ? <Alert severity="error"><AlertTitle>H: CRS</AlertTitle>Every collection within a collections array MUST have a crs parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>H: CRS</AlertTitle>{collection.crs}</Alert>
              }
              
              { (!collection.output_formats || !Array.isArray(collection.output_formats))
                ? <Alert severity="error"><AlertTitle>I: OUTPUT_FORMATS</AlertTitle>Every collection within a collections array MUST have an output_formats parameter.</Alert>
                : (
                  <Alert severity="success">
                    <AlertTitle>I: OUTPUT_FORMATS</AlertTitle>
                    {collection.output_formats.join(', ')}
                  </Alert>
                )
              }

              { typeof collection.parameter_names == "undefined"
                ? <Alert severity="error"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>Every collection within a collections array MUST have a parameter_names parameter.</Alert>
                : (
                  <Alert severity="success">
                    <AlertTitle>J: PARAMETER_NAMES</AlertTitle>
                    {Array.isArray(collection.parameter_names)
                      ? collection.parameter_names.map((param) => (
                          <div key={param.id}>
                            {param.label || param.id} ({param.type || 'unknown'})
                          </div>
                        ))
                      : Object.keys(collection.parameter_names).map((paramKey) => {
                          const params = collection.parameter_names as { [key: string]: any };
                          return (
                            <div key={paramKey}>
                              {params[paramKey]?.description || paramKey} ({params[paramKey]?.type || 'unknown'})
                            </div>
                          );
                        })
                    }
                  </Alert>
                )
              }
              </Box>
              </Collapse>
            </Collapse>
          </React.Fragment>
        ))}
      </List>
    </Paper>
    </Box>
  );
};

export default Sidebar;