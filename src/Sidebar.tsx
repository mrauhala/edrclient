import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Select from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import React, { useEffect, useState, useMemo } from 'react';
import { Collection, ValidationResult, GetCollectionsResult, normalizeBbox, hasLocationQuery, getLocationQueryUrl, executeLocationQuery, normalizeTemporal, formatConformanceClass, expandTemporalValues, expandVerticalValues, expandCustomDimensionValues, getOverallTemporalExtent, Link as ApiLink, normalizeHref } from './DataRetrievalAPI';
import CollectionInfo, { parseLicense, LicenseInfo } from './CollectionInfo';
import ValidationResults from './ValidationResult';
import LocationFeatureList from './LocationFeatureList';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';
import CollectionValidationErrors from './CollectionValidationErrors';
import ItemsTable from './ItemsTable';
import KeywordChips from './KeywordChips';
import ServiceSelector from './ServiceSelector';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { useMapInteraction } from './contexts/MapInteractionContext';
import { useCollection } from './contexts/CollectionContext';
import { useService } from './contexts/ServiceContext';
import { useQueryUrl } from './hooks/useQueryUrl';

// Configure dayjs to use UTC plugin
dayjs.extend(utc);

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
  const {
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
  } = useQueryUrl();

  const [currentApiUrl, setCurrentApiUrl] = useState('https://opendata.fmi.fi/edr');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true, errors: null });
  const [showValidationDetails, setShowValidationDetails] = useState(false);
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
  const [showServiceLinks, setShowServiceLinks] = useState(false); // State for collapsible links section
  const [showConformanceClasses, setShowConformanceClasses] = useState(false); // State for collapsible conformance section
  const [showValidation, setShowValidation] = useState(false); // State for collapsible validation section
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



  const toggleValidationDetails = () => {
    setShowValidationDetails(!showValidationDetails);
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
      
      <Card sx={{ minWidth: 275 }}>
        <CardContent>
          {/* Service Information from Landing Page */}
          {(landingPageTitle || landingPageDescription) && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.08)', borderRadius: 1 }}>
              {landingPageTitle && (
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                  {landingPageTitle}
                </Typography>
              )}
              {landingPageDescription && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {landingPageDescription}
                </Typography>
              )}
              {landingPageKeywords && landingPageKeywords.length > 0 && (
                <KeywordChips keywords={landingPageKeywords} />
              )}
            </Box>
          )}
          
          {/* OGC API Conformance Classes */}
          {conformsTo && conformsTo.length > 0 && (() => {
            // Filter and format OGC API conformance classes, keeping original URLs
            const ogcApiConformance = conformsTo
              .map(url => ({
                url,
                formatted: formatConformanceClass(url)
              }))
              .filter(item => item.formatted !== null);
            
            // Remove duplicates based on URL
            const uniqueConformance = Array.from(
              new Map(ogcApiConformance.map(item => [item.url, item])).values()
            );
            
            if (uniqueConformance.length > 0) {
              return (
                <Box sx={{ mb: 2 }}>
                  <ListItemButton 
                    onClick={() => setShowConformanceClasses(!showConformanceClasses)}
                    sx={{ 
                      p: 1.5, 
                      backgroundColor: 'rgba(76, 175, 80, 0.08)', 
                      borderRadius: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(76, 175, 80, 0.15)',
                      }
                    }}
                  >
                    <ListItemText 
                      primary={
                        <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 600 }}>
                          Conformance Classes ({uniqueConformance.length})
                        </Typography>
                      }
                    />
                    {showConformanceClasses ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={showConformanceClasses} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {uniqueConformance.map((item, index) => (
                        <Tooltip key={index} title={item.url} arrow>
                          <Chip
                            label={item.formatted}
                            size="small"
                            color="success"
                            variant="outlined"
                            onClick={() => setSelectedConformanceUrl(item.url)}
                            clickable
                            sx={{ 
                              fontSize: '0.7rem',
                              height: '22px',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                              }
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              );
            }
            return null;
          })()}
          
          {/* Service Links Section */}
          {landingPageLinks && landingPageLinks.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <ListItemButton 
                onClick={() => setShowServiceLinks(!showServiceLinks)}
                sx={{ 
                  p: 1.5, 
                  backgroundColor: 'rgba(156, 39, 176, 0.08)', 
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(156, 39, 176, 0.15)',
                  }
                }}
              >
                <ListItemText 
                  primary={
                    <Typography variant="subtitle2" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                      Service Links ({landingPageLinks.length})
                    </Typography>
                  }
                />
                {showServiceLinks ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={showServiceLinks} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {landingPageLinks.map((link, index) => {
                    // Normalize href which might be a string or an object
                    const normalizedHref = normalizeHref(link.href);
                    
                    // Skip links without valid href to prevent crashes
                    if (!normalizedHref) {
                      return null;
                    }
                    return (
                      <ListItemButton
                        key={index}
                        sx={{ pl: 3, py: 0.5 }}
                        component="a"
                        href={normalizedHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              {link.title || link.rel || 'Link'}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block' }}>
                                {link.rel && `rel: ${link.rel}`}
                                {link.type && ` • type: ${link.type}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', wordBreak: 'break-all' }}>
                                {normalizedHref}
                              </Typography>
                            </>
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          )}
          
          {/* Schema Validation Section */}
          <Box sx={{ mb: 2 }}>
            <ListItemButton 
              onClick={() => setShowValidation(!showValidation)}
              sx={{ 
                p: 1.5, 
                backgroundColor: !validationResult.isValid ? 'rgba(237, 108, 2, 0.08)' : 'rgba(46, 125, 50, 0.08)', 
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: !validationResult.isValid ? 'rgba(237, 108, 2, 0.15)' : 'rgba(46, 125, 50, 0.15)',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                {!validationResult.isValid ? (
                  <ErrorIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                ) : (
                  <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                )}
                <ListItemText 
                  primary={
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Schema Validation Status
                      {!validationResult.isValid && (() => {
                        // Count validation failures
                        let failureCount = 0;
                        if (validationResult.landingPageValidation && !validationResult.landingPageValidation.isValid) failureCount++;
                        if (validationResult.collectionsValidation && !validationResult.collectionsValidation.isValid) failureCount++;
                        if (validationResult.conformanceValidation && !validationResult.conformanceValidation.isValid) failureCount++;
                        
                        return failureCount > 0 ? (
                          <Chip 
                            label={`${failureCount} issue${failureCount > 1 ? 's' : ''}`}
                            size="small"
                            color="warning"
                            sx={{ ml: 1, height: 20 }}
                          />
                        ) : null;
                      })()}
                    </Typography>
                  }
                />
              </Box>
              {showValidation ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={showValidation} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2 }}>
                <ValidationResults 
                  validation={validationResult} 
                  expanded={showValidationDetails} 
                />
                
                {validationResult.errors && validationResult.errors.length > 0 && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={toggleValidationDetails}
                    sx={{ mt: 1 }}
                  >
                    {showValidationDetails ? 'Hide Details' : 'Show Details'}
                  </Button>
                )}
              </Box>
            </Collapse>
          </Box>
        </CardContent>
      </Card>
      
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
                {/* Data Query Selector */}
                { typeof collection.data_queries !== "undefined" && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="data-query-select-label">Data Query</InputLabel>
                    <Select
                      labelId="data-query-select-label"
                      value={selectedDataQuery}
                      label="Data Query"
                      onChange={(e) => {
                        const queryType = e.target.value;
                        setSelectedDataQuery(queryType);

                        // Auto-select format for this data query
                        const effectiveFormats = getEffectiveOutputFormats(collection, queryType);
                        let formatToUse = selectedFormat;
                        if (selectedFormat && !effectiveFormats.includes(selectedFormat)) {
                          formatToUse = '';
                        }
                        if (!formatToUse && queryType && collection.data_queries[queryType]?.link?.variables?.default_output_format) {
                          const defaultFormat = collection.data_queries[queryType].link.variables.default_output_format;
                          if (effectiveFormats.includes(defaultFormat)) {
                            formatToUse = defaultFormat;
                          }
                        }
                        if (formatToUse !== selectedFormat) {
                          setSelectedFormat(formatToUse);
                        }

                        setDataQuery(queryType);
                        if (queryType.toLowerCase() !== 'position') {
                          setClickedCoords([]);
                        }
                        // URL rebuild is handled by useQueryUrl consolidated effect
                      }}
                      size="small"
                    >
                      <MenuItem value="">
                        <em>Select a data query</em>
                      </MenuItem>
                      {Object.keys(collection.data_queries).map((queryKey) => (
                        <MenuItem key={queryKey} value={queryKey}>
                          {queryKey}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Format Selector */}
                {(() => {
                  const effectiveFormats = getEffectiveOutputFormats(collection, selectedDataQuery);
                  return effectiveFormats.length > 0 && (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="format-select-label">Output Format</InputLabel>
                      <Select
                        labelId="format-select-label"
                        value={selectedFormat}
                        label="Output Format"
                        onChange={(e) => {
                          setSelectedFormat(e.target.value);
                        }}
                        size="small"
                      >
                        <MenuItem value="">
                          <em>Select a format</em>
                        </MenuItem>
                        {effectiveFormats.map((format) => (
                          <MenuItem key={format} value={format}>
                            {format}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                })()}

                {/* Parameter Selector - Multiselect */}
                { typeof collection.parameter_names !== "undefined" && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="parameter-select-label">Parameters</InputLabel>
                    <Select
                      labelId="parameter-select-label"
                      multiple
                      value={selectedParameters}
                      label="Parameters"
                      onChange={(e) => {
                        const parameters = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                        setSelectedParameters(parameters);
                      }}
                      size="small"
                      renderValue={(selected) => selected.join(', ')}
                    >
                      {Array.isArray(collection.parameter_names)
                        ? collection.parameter_names.map((param) => (
                            <MenuItem key={param.id} value={param.id}>
                              <Checkbox checked={selectedParameters.indexOf(param.id) > -1} />
                              <ListItemText primary={param.label || param.id} />
                            </MenuItem>
                          ))
                        : Object.keys(collection.parameter_names || {}).map((paramKey) => {
                            const params = collection.parameter_names as { [key: string]: any };
                            return (
                              <MenuItem key={paramKey} value={paramKey}>
                                <Checkbox checked={selectedParameters.indexOf(paramKey) > -1} />
                                <ListItemText primary={params[paramKey]?.description || paramKey} />
                              </MenuItem>
                            );
                          })
                      }
                    </Select>
                  </FormControl>
                )}

                {/* Datetime Selector */}
                {collection.extent?.temporal && (() => {
                  const temporalValues = expandTemporalValues(collection.extent.temporal, 500);
                  const hasValues = collection.extent.temporal.values && collection.extent.temporal.values.length > 0;
                  const hasInterval = collection.extent.temporal.interval && collection.extent.temporal.interval.length > 0;
                  
                  // Check if we have too many values (from large repeating intervals)
                  // If so, use DateTimePicker instead of dropdown
                  const tooManyValues = temporalValues.length > 250;
                  const useDropdown = hasValues && !tooManyValues;
                  
                  // Show temporal selection UI if collection has temporal extent (values OR interval)
                  return (hasValues || hasInterval) ? (
                    <Box sx={{ mb: 2 }}>
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>Date/Time Selection</FormLabel>
                      
                      {/* Info message when using date picker due to large intervals */}
                      {tooManyValues && (
                        <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                          <Typography variant="caption">
                            This collection has a large repeating interval ({temporalValues.length} values, limit: 250). Using date/time picker for easier selection.
                          </Typography>
                        </Alert>
                      )}
                      
                      {/* Datetime Mode Selector - always show when temporal extent exists */}
                      <FormControl component="fieldset" sx={{ mb: 1 }}>
                        <RadioGroup
                          row
                          value={datetimeMode}
                          onChange={(e) => {
                            const newMode = e.target.value as 'individual' | 'range';
                            setDatetimeMode(newMode);
                            // Clear selections when switching modes
                            if (newMode === 'range') {
                              setSelectedDatetime('');
                            } else {
                              setStartDatetime('');
                              setEndDatetime('');
                            }
                          }}
                          sx={{ gap: 2 }}
                        >
                          <FormControlLabel 
                            value="individual" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Individual Time</Typography>}
                          />
                          <FormControlLabel 
                            value="range" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Time Range</Typography>}
                          />
                        </RadioGroup>
                      </FormControl>

                      {/* Quick Select Presets for Time Ranges */}
                      {datetimeMode === 'range' && (() => {
                        // Get temporal extent bounds using the utility function
                        const normalizedTemporal = normalizeTemporal(collection.extent.temporal);
                        let extentStart: dayjs.Dayjs | null = null;
                        let extentEnd: dayjs.Dayjs | null = null;
                        
                        if (normalizedTemporal && normalizedTemporal.intervals.length > 0) {
                          const overallExtent = getOverallTemporalExtent(normalizedTemporal.intervals);
                          if (overallExtent) {
                            extentStart = overallExtent[0] && overallExtent[0] !== '..' ? dayjs.utc(overallExtent[0]) : null;
                            extentEnd = overallExtent[1] && overallExtent[1] !== '..' ? dayjs.utc(overallExtent[1]) : null;
                          }
                        }
                        
                        // Helper to check if a preset range is valid
                        const isPresetValid = (presetStart: dayjs.Dayjs, presetEnd: dayjs.Dayjs): boolean => {
                          // Open-ended extents are fine - validate only if bounds exist
                          // For start: if extent has a start, preset start must be >= extent start
                          if (extentStart && presetStart.isBefore(extentStart)) {
                            return false;
                          }
                          
                          // For end: if extent has an end, preset end must be <= extent end
                          if (extentEnd && presetEnd.isAfter(extentEnd)) {
                            return false;
                          }
                          
                          return true;
                        };
                        
                        const now = dayjs.utc();
                        
                        // Define all possible presets
                        const presets = [
                          // Backward-looking presets
                          { 
                            label: 'Last Hour', 
                            start: now.subtract(1, 'hour'), 
                            end: now 
                          },
                          { 
                            label: 'Today', 
                            start: now.startOf('day'), 
                            end: now 
                          },
                          { 
                            label: 'Last 7 Days', 
                            start: now.subtract(7, 'day'), 
                            end: now 
                          },
                          { 
                            label: 'This Month', 
                            start: now.startOf('month'), 
                            end: now 
                          },
                          { 
                            label: 'Last 30 Days', 
                            start: now.subtract(30, 'day'), 
                            end: now 
                          },
                          // Forward-looking presets
                          { 
                            label: 'Next 24 Hours', 
                            start: now, 
                            end: now.add(24, 'hour') 
                          },
                          { 
                            label: 'Next 5 Days', 
                            start: now, 
                            end: now.add(5, 'day') 
                          },
                          { 
                            label: 'Next 7 Days', 
                            start: now, 
                            end: now.add(7, 'day') 
                          },
                          { 
                            label: 'Next 30 Days', 
                            start: now, 
                            end: now.add(30, 'day') 
                          },
                        ];
                        
                        // Filter presets to only show valid ones
                        const validPresets = presets.filter(preset => isPresetValid(preset.start, preset.end));
                        
                        return validPresets.length > 0 ? (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
                              Quick Select:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {validPresets.map((preset, idx) => (
                                <Button
                                  key={idx}
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    // Clamp dates to extent bounds if necessary
                                    let start = preset.start;
                                    let end = preset.end;
                                    
                                    if (extentStart && start.isBefore(extentStart)) {
                                      start = extentStart;
                                    }
                                    if (extentEnd && end.isAfter(extentEnd)) {
                                      end = extentEnd;
                                    }
                                    
                                    setStartDatetime(start.format('YYYY-MM-DDTHH:mm:ss[Z]'));
                                    setEndDatetime(end.format('YYYY-MM-DDTHH:mm:ss[Z]'));
                                  }}
                                  sx={{ 
                                    fontSize: '0.7rem', 
                                    py: 0.25, 
                                    px: 1,
                                    minWidth: 'auto',
                                    textTransform: 'none'
                                  }}
                                >
                                  {preset.label}
                                </Button>
                              ))}
                            </Box>
                          </Box>
                        ) : null;
                      })()}

                      {/* Individual Time - show dropdown if values exist, otherwise show DateTimePicker */}
                      {datetimeMode === 'individual' && (
                        useDropdown ? (
                          <FormControl fullWidth>
                            <InputLabel id="datetime-select-label">Select Time</InputLabel>
                            <Select
                              labelId="datetime-select-label"
                              value={selectedDatetime}
                              label="Select Time"
                              onChange={(e) => {
                                const datetime = e.target.value as string;
                                setSelectedDatetime(datetime);
                              }}
                              size="small"
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    maxHeight: 300,
                                  },
                                },
                              }}
                            >
                              {temporalValues.map((datetime) => (
                                <MenuItem key={datetime} value={datetime}>
                                  <ListItemText 
                                    primary={datetime}
                                    primaryTypographyProps={{ 
                                      style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                    }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DateTimePicker
                              label="Date/Time"
                              value={selectedDatetime ? dayjs.utc(selectedDatetime) : null}
                              onChange={(newValue: Dayjs | null) => {
                                // Convert to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
                                const isoDatetime = newValue ? newValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '';
                                setSelectedDatetime(isoDatetime);
                                // URL will be updated by useEffect
                              }}
                              format="DD/MM/YYYY HH:mm"
                              ampm={false}
                              slotProps={{
                                textField: {
                                  fullWidth: true,
                                  size: 'small',
                                },
                              }}
                            />
                          </LocalizationProvider>
                        )
                      )}

                      {/* Time Range Selectors - show when in range mode */}
                      {datetimeMode === 'range' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {/* Show dropdowns with list if we have actual values and not too many */}
                          {useDropdown ? (
                            <>
                              <FormControl fullWidth size="small">
                                <InputLabel id="start-datetime-label">Start Time</InputLabel>
                                <Select
                                  labelId="start-datetime-label"
                                  value={startDatetime}
                                  label="Start Time"
                                  onChange={(e) => {
                                    const newStart = e.target.value;
                                    setStartDatetime(newStart);
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 300,
                                      },
                                    },
                                  }}
                                >
                                  <MenuItem value="">
                                    <em>Select start time</em>
                                  </MenuItem>
                                  {temporalValues.map((datetime) => (
                                    <MenuItem key={datetime} value={datetime}>
                                      <ListItemText 
                                        primary={datetime}
                                        primaryTypographyProps={{ 
                                          style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                        }}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              <FormControl fullWidth size="small">
                                <InputLabel id="end-datetime-label">End Time</InputLabel>
                                <Select
                                  labelId="end-datetime-label"
                                  value={endDatetime}
                                  label="End Time"
                                  onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setEndDatetime(newEnd);
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 300,
                                      },
                                    },
                                  }}
                                >
                                  <MenuItem value="">
                                    <em>Select end time</em>
                                  </MenuItem>
                                  {temporalValues.map((datetime) => (
                                    <MenuItem key={datetime} value={datetime}>
                                      <ListItemText 
                                        primary={datetime}
                                        primaryTypographyProps={{ 
                                          style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                        }}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </>
                          ) : (
                            /* Show date/time pickers if no values exist */
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                              <DateTimePicker
                                label="Start Date/Time"
                                value={startDatetime ? dayjs.utc(startDatetime) : null}
                                onChange={(newValue: Dayjs | null) => {
                                  // Convert to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
                                  const isoStart = newValue ? newValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '';
                                  setStartDatetime(isoStart);
                                  // URL will be updated by useEffect
                                }}
                                format="DD/MM/YYYY HH:mm"
                                ampm={false}
                                slotProps={{
                                  textField: {
                                    fullWidth: true,
                                    size: 'small',
                                  },
                                }}
                              />

                              <DateTimePicker
                                label="End Date/Time"
                                value={endDatetime ? dayjs.utc(endDatetime) : null}
                                onChange={(newValue: Dayjs | null) => {
                                  // Convert to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
                                  const isoEnd = newValue ? newValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]') : '';
                                  setEndDatetime(isoEnd);
                                  // URL will be updated by useEffect
                                }}
                                format="DD/MM/YYYY HH:mm"
                                ampm={false}
                                slotProps={{
                                  textField: {
                                    fullWidth: true,
                                    size: 'small',
                                  },
                                }}
                              />
                            </LocalizationProvider>
                          )}
                        </Box>
                      )}
                    </Box>
                  ) : null;
                })()}

                {/* Vertical Extent Selector */}
                {collection.extent?.vertical && (() => {
                  const verticalValues = expandVerticalValues(collection.extent.vertical, 500);
                  const hasValues = collection.extent.vertical.values && collection.extent.vertical.values.length > 0;
                  const hasInterval = collection.extent.vertical.interval && collection.extent.vertical.interval.length > 0;
                  
                  // Check if we have too many values (from large intervals)
                  // If so, use TextField instead of dropdown
                  const tooManyValues = verticalValues.length > 250;
                  const useDropdown = hasValues && !tooManyValues;
                  
                  // Show vertical selection UI if collection has vertical extent (values OR interval)
                  return (hasValues || hasInterval) ? (
                    <Box sx={{ mb: 2 }}>
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>Vertical Level Selection</FormLabel>
                      
                      {/* Info message when using text input due to large intervals */}
                      {tooManyValues && (
                        <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                          <Typography variant="caption">
                            This collection has a large vertical range ({verticalValues.length} values, limit: 250). Using text input for easier selection.
                          </Typography>
                        </Alert>
                      )}
                      
                      {/* Vertical Mode Selector - always show when vertical extent exists */}
                      <FormControl component="fieldset" sx={{ mb: 1 }}>
                        <RadioGroup
                          row
                          value={verticalMode}
                          onChange={(e) => {
                            const newMode = e.target.value as 'individual' | 'range';
                            setVerticalMode(newMode);
                            // Clear selections when switching modes
                            if (newMode === 'range') {
                              setSelectedVertical('');
                            } else {
                              setStartVertical('');
                              setEndVertical('');
                            }
                          }}
                          sx={{ gap: 2 }}
                        >
                          <FormControlLabel 
                            value="individual" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Individual Level</Typography>}
                          />
                          <FormControlLabel 
                            value="range" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Level Range</Typography>}
                          />
                        </RadioGroup>
                      </FormControl>

                      {/* Individual Level - show dropdown if values exist, otherwise show TextField */}
                      {verticalMode === 'individual' && (
                        useDropdown ? (
                          <FormControl fullWidth>
                            <InputLabel id="vertical-select-label">Select Level</InputLabel>
                            <Select
                              labelId="vertical-select-label"
                              value={selectedVertical}
                              label="Select Level"
                              onChange={(e) => {
                                const vertical = e.target.value as string;
                                setSelectedVertical(vertical);
                              }}
                              size="small"
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    maxHeight: 300,
                                  },
                                },
                              }}
                            >
                              {verticalValues.map((level) => (
                                <MenuItem key={level} value={level}>
                                  <ListItemText 
                                    primary={level}
                                    primaryTypographyProps={{ 
                                      style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                    }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            label="Vertical Level"
                            value={selectedVertical}
                            onChange={(e) => {
                              const vertical = e.target.value;
                              setSelectedVertical(vertical);
                            }}
                            fullWidth
                            size="small"
                            placeholder="Enter vertical level (e.g., 1000)"
                            helperText="Enter a numeric value"
                          />
                        )
                      )}

                      {/* Level Range Selectors - show when in range mode */}
                      {verticalMode === 'range' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {/* Show dropdowns with list if we have actual values and not too many */}
                          {useDropdown ? (
                            <>
                              <FormControl fullWidth size="small">
                                <InputLabel id="start-vertical-label">Start Level</InputLabel>
                                <Select
                                  labelId="start-vertical-label"
                                  value={startVertical}
                                  label="Start Level"
                                  onChange={(e) => {
                                    const newStart = e.target.value;
                                    setStartVertical(newStart);
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 300,
                                      },
                                    },
                                  }}
                                >
                                  <MenuItem value="">
                                    <em>Select start level</em>
                                  </MenuItem>
                                  {verticalValues.map((level) => (
                                    <MenuItem key={level} value={level}>
                                      <ListItemText 
                                        primary={level}
                                        primaryTypographyProps={{ 
                                          style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                        }}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              <FormControl fullWidth size="small">
                                <InputLabel id="end-vertical-label">End Level</InputLabel>
                                <Select
                                  labelId="end-vertical-label"
                                  value={endVertical}
                                  label="End Level"
                                  onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setEndVertical(newEnd);
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 300,
                                      },
                                    },
                                  }}
                                >
                                  <MenuItem value="">
                                    <em>Select end level</em>
                                  </MenuItem>
                                  {verticalValues.map((level) => (
                                    <MenuItem key={level} value={level}>
                                      <ListItemText 
                                        primary={level}
                                        primaryTypographyProps={{ 
                                          style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                        }}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </>
                          ) : (
                            /* Show text inputs if no values exist or too many */
                            <>
                              <TextField
                                label="Start Level"
                                value={startVertical}
                                onChange={(e) => {
                                  const newStart = e.target.value;
                                  setStartVertical(newStart);
                                }}
                                fullWidth
                                size="small"
                                placeholder="Enter start level"
                                helperText="Enter a numeric value"
                              />
                              <TextField
                                label="End Level"
                                value={endVertical}
                                onChange={(e) => {
                                  const newEnd = e.target.value;
                                  setEndVertical(newEnd);
                                }}
                                fullWidth
                                size="small"
                                placeholder="Enter end level"
                                helperText="Enter a numeric value"
                              />
                            </>
                          )}
                        </Box>
                      )}
                    </Box>
                  ) : null;
                })()}

                {/* Custom Dimension Selectors */}
                {collection.extent?.custom && collection.extent.custom.length > 0 && collection.extent.custom.map((dimension) => {
                  const dimensionId = dimension.id;
                  const dimensionValues = expandCustomDimensionValues(dimension, 500);
                  const hasValues = dimension.values && dimension.values.length > 0;
                  const hasInterval = dimension.interval && dimension.interval.length > 0;
                  
                  // Check if we have too many values (from large intervals)
                  const tooManyValues = dimensionValues.length > 250;
                  const useDropdown = hasValues && !tooManyValues;
                  
                  // Show dimension selection UI if dimension has values OR interval
                  return (hasValues || hasInterval) ? (
                    <Box key={dimensionId} sx={{ mb: 2 }}>
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>
                        {dimension.id} Selection {dimension.reference ? `(${dimension.reference})` : ''}
                      </FormLabel>
                      
                      {/* Info message when using text input due to large intervals */}
                      {tooManyValues && (
                        <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                          <Typography variant="caption">
                            This dimension has a large range ({dimensionValues.length} values, limit: 250). Using text input for easier selection.
                          </Typography>
                        </Alert>
                      )}
                      
                      {/* Dimension Mode Selector */}
                      <FormControl component="fieldset" sx={{ mb: 1 }}>
                        <RadioGroup
                          row
                          value={customDimensionModes[dimensionId] || 'individual'}
                          onChange={(e) => {
                            const newMode = e.target.value as 'individual' | 'range';
                            setCustomDimensionModes(prev => ({ ...prev, [dimensionId]: newMode }));
                            // Clear selections when switching modes
                            if (newMode === 'range') {
                              setSelectedCustomDimensions(prev => {
                                const updated = { ...prev };
                                delete updated[dimensionId];
                                return updated;
                              });
                            } else {
                              setCustomDimensionStarts(prev => {
                                const updated = { ...prev };
                                delete updated[dimensionId];
                                return updated;
                              });
                              setCustomDimensionEnds(prev => {
                                const updated = { ...prev };
                                delete updated[dimensionId];
                                return updated;
                              });
                            }
                          }}
                          sx={{ gap: 2 }}
                        >
                          <FormControlLabel 
                            value="individual" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Individual Value</Typography>}
                          />
                          <FormControlLabel 
                            value="range" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Range</Typography>}
                          />
                        </RadioGroup>
                      </FormControl>

                      {/* Individual Value Selector */}
                      {(customDimensionModes[dimensionId] || 'individual') === 'individual' && (
                        useDropdown ? (
                          <FormControl fullWidth>
                            <InputLabel id={`${dimensionId}-select-label`}>Select Value</InputLabel>
                            <Select
                              labelId={`${dimensionId}-select-label`}
                              value={selectedCustomDimensions[dimensionId] || ''}
                              label="Select Value"
                              onChange={(e) => {
                                const value = e.target.value as string;
                                setSelectedCustomDimensions(prev => ({ ...prev, [dimensionId]: value }));
                              }}
                              size="small"
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    maxHeight: 300,
                                  },
                                },
                              }}
                            >
                              {dimensionValues.map((val) => (
                                <MenuItem key={val} value={val}>
                                  <ListItemText 
                                    primary={val}
                                    primaryTypographyProps={{ 
                                      style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                    }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <TextField
                            label="Value"
                            value={selectedCustomDimensions[dimensionId] || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSelectedCustomDimensions(prev => ({ ...prev, [dimensionId]: value }));
                            }}
                            fullWidth
                            size="small"
                            placeholder="Enter value"
                            helperText={dimension.reference ? `Unit: ${dimension.reference}` : ''}
                          />
                        )
                      )}

                      {/* Range Selectors */}
                      {(customDimensionModes[dimensionId] || 'individual') === 'range' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {useDropdown ? (
                            <>
                              <FormControl fullWidth size="small">
                                <InputLabel id={`start-${dimensionId}-label`}>Start Value</InputLabel>
                                <Select
                                  labelId={`start-${dimensionId}-label`}
                                  value={customDimensionStarts[dimensionId] || ''}
                                  label="Start Value"
                                  onChange={(e) => {
                                    const newStart = e.target.value;
                                    setCustomDimensionStarts(prev => ({ ...prev, [dimensionId]: newStart }));
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 300,
                                      },
                                    },
                                  }}
                                >
                                  <MenuItem value="">
                                    <em>Select start value</em>
                                  </MenuItem>
                                  {dimensionValues.map((val) => (
                                    <MenuItem key={val} value={val}>
                                      <ListItemText 
                                        primary={val}
                                        primaryTypographyProps={{ 
                                          style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                        }}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              <FormControl fullWidth size="small">
                                <InputLabel id={`end-${dimensionId}-label`}>End Value</InputLabel>
                                <Select
                                  labelId={`end-${dimensionId}-label`}
                                  value={customDimensionEnds[dimensionId] || ''}
                                  label="End Value"
                                  onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setCustomDimensionEnds(prev => ({ ...prev, [dimensionId]: newEnd }));
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 300,
                                      },
                                    },
                                  }}
                                >
                                  <MenuItem value="">
                                    <em>Select end value</em>
                                  </MenuItem>
                                  {dimensionValues.map((val) => (
                                    <MenuItem key={val} value={val}>
                                      <ListItemText 
                                        primary={val}
                                        primaryTypographyProps={{ 
                                          style: { fontSize: '0.85rem', fontFamily: 'monospace' } 
                                        }}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </>
                          ) : (
                            <>
                              <TextField
                                label="Start Value"
                                value={customDimensionStarts[dimensionId] || ''}
                                onChange={(e) => {
                                  const newStart = e.target.value;
                                  setCustomDimensionStarts(prev => ({ ...prev, [dimensionId]: newStart }));
                                }}
                                fullWidth
                                size="small"
                                placeholder="Enter start value"
                                helperText={dimension.reference ? `Unit: ${dimension.reference}` : ''}
                              />
                              <TextField
                                label="End Value"
                                value={customDimensionEnds[dimensionId] || ''}
                                onChange={(e) => {
                                  const newEnd = e.target.value;
                                  setCustomDimensionEnds(prev => ({ ...prev, [dimensionId]: newEnd }));
                                }}
                                fullWidth
                                size="small"
                                placeholder="Enter end value"
                                helperText={dimension.reference ? `Unit: ${dimension.reference}` : ''}
                              />
                            </>
                          )}
                        </Box>
                      )}
                    </Box>
                  ) : null;
                })}

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