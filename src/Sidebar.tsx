import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import LayersIcon from '@mui/icons-material/Layers';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import React, { useEffect, useState } from 'react';
import { getCollections, Collection, ValidationResult, normalizeBbox, hasLocationQuery, getLocationQueryUrl, executeLocationQuery, getSupportedDataQueries, normalizeTemporal, formatConformanceClass } from './DataRetrievalAPI';
import ValidationResults from './ValidationResult';
import SchemaInspector from './SchemaInspector';
import LocationFeatureList from './LocationFeatureList';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';
import CollectionValidationErrors from './CollectionValidationErrors';
import SwaggerUIViewer from './SwaggerUIViewer';
import ConformanceViewer from './ConformanceViewer';

interface SidebarProps {
  open: boolean;
  boundingBox: [number, number, number, number];
  setBoundingBox: any;
  onClose: () => void;
  onCollectionExtentChange?: (extents: [number, number, number, number][] | null) => void;
  onLocationFeaturesChange?: (features: any[] | null) => void;
  onFeatureSelect?: (feature: any) => void;
  onSelectedCollectionChange?: (collection: Collection | null) => void;
  onMapClick?: (coords: [number, number] | null) => void;
  onDataQueryChange?: (dataQuery: string) => void;
  onCollectionUrlChange?: (url: string) => void;
  clickedCoords?: [number, number] | null;
  locationFeatures?: any[] | null;
}

// EDR service options
const edrServices = [
  { label: 'FMI Open Data', value: 'https://opendata.fmi.fi/edr' },
  { label: 'SWIM Met Norway', value: 'https://swim.met.no' },
  { label: 'Norwegian Met Office Isobaric', value: 'https://edrisobaric.k8s.met.no' },
  { label: 'SWIM iblsoft (Test empty bbox)', value: 'https://swim.iblsoft.com/edr' },
  { label: 'Met Office Labs', value: 'https://labs.metoffice.gov.uk/edr' },
  { label: 'Aviation Weather (WIFS)', value: 'https://aviationweather.gov/wifs/api' },
  { label: 'Meteogate Observations', value: 'https://observations.meteogate.eu' },
  { label: 'SmartMet Kenya', value: 'https://data-kenya.smartmet.org/edr' },
  { label: 'DWD WIS2 GDC', value: 'https://wis2.dwd.de/gdc/' },
  { label: 'Canada WIS2 GDC', value: 'https://wis2-gdc.weather.gc.ca' },
  { label: 'China WIS2 GDC', value: 'https://gdc.wis.cma.cn' },
  { label: 'Custom', value: '' }
];

const Sidebar = ({ open, onClose, boundingBox, setBoundingBox, onCollectionExtentChange, onLocationFeaturesChange, onFeatureSelect, onSelectedCollectionChange, onMapClick, onDataQueryChange, onCollectionUrlChange, clickedCoords, locationFeatures }: SidebarProps) => {
  const [apiUrl, setApiUrl] = useState('https://opendata.fmi.fi/edr');
  const [selectedService, setSelectedService] = useState('https://opendata.fmi.fi/edr');
  const [inputUrl, setInputUrl] = useState('https://opendata.fmi.fi/edr'); // Separate state for text input
  const [queryUrl, setQueryUrl] = useState('https://opendata.fmi.fi/edr');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true, errors: null });
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocationCollection, setCurrentLocationCollection] = useState<string | null>(null);
  const [landingPageUrl, setLandingPageUrl] = useState<string | null>(null);
  const [collectionsUrl, setCollectionsUrl] = useState<string | null>(null);
  const [conformanceUrl, setConformanceUrl] = useState<string | null>(null);
  const [landingPageTitle, setLandingPageTitle] = useState<string | null>(null);
  const [landingPageDescription, setLandingPageDescription] = useState<string | null>(null);
  const [serviceDescUrl, setServiceDescUrl] = useState<string | null>(null);
  const [conformsTo, setConformsTo] = useState<string[] | null>(null);
  const [selectedConformanceUrl, setSelectedConformanceUrl] = useState<string | null>(null);
  const [validationTrigger, setValidationTrigger] = useState(0); // Counter to force re-validation
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedDataQuery, setSelectedDataQuery] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [collectionUrl, setCollectionUrl] = useState<string>('');
  const [showCollectionValidation, setShowCollectionValidation] = useState<{[key: string]: boolean}>({});

  // Debounce effect for text input - only update apiUrl after 1 second of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputUrl !== apiUrl) {
        setApiUrl(inputUrl);
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [inputUrl, apiUrl]);

  useEffect(() => {
    async function loadCollections() {
      setIsLoading(true);
      // Clear previous collections and state when starting new load
      setCollections([]);
      setOpenCollectionIndex(null);
      
      try {
        console.log('Loading collections from:', apiUrl);
        const result = await getCollections(apiUrl);
        
        // Always update collections, even if empty (to clear previous results)
        setCollections(result.collections || []);
        console.log(`Loaded ${result.collections?.length || 0} collections`);
        
        // Update validation result
        setValidationResult(result.validation);
        
        // Update URLs for display
        setLandingPageUrl(result.landingPageUrl || null);
        setCollectionsUrl(result.collectionsUrl || null);
        setConformanceUrl(result.conformanceUrl || null);
        
        // Update landing page info for display
        setLandingPageTitle(result.landingPageTitle || null);
        setLandingPageDescription(result.landingPageDescription || null);
        setServiceDescUrl(result.serviceDescUrl || null);
        setConformsTo(result.conformsTo || null);
        
        // Clear any previous extent/location data when switching services
        if (onCollectionExtentChange) {
          onCollectionExtentChange(null);
        }
        if (onLocationFeaturesChange) {
          onLocationFeaturesChange(null);
        }
        if (onSelectedCollectionChange) {
          onSelectedCollectionChange(null);
        }
      } catch (error) {
        console.error('Error loading collections:', error);
        setCollections([]); // Clear collections on error
        setValidationResult({
          isValid: false,
          errors: [{ message: error instanceof Error ? error.message : 'Unknown error loading collections' }]
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, validationTrigger]); // Added validationTrigger to dependencies

  const [openCollectionIndex, setOpenCollectionIndex] = useState<number | null>(null);

  // Effect to rebuild URL when clicked coordinates change
  useEffect(() => {
    if (selectedDataQuery && selectedDataQuery.toLowerCase() === 'position' && clickedCoords) {
      const isDataQuery = !!selectedDataQuery;
      // Find the current collection and rebuild the URL
      if (selectedCollection && selectedCollection.data_queries[selectedDataQuery]?.link) {
        const baseUrl = selectedCollection.data_queries[selectedDataQuery].link.href;
        setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, selectedDataQuery));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedCoords]);

  // Effect to notify parent when URL changes
  useEffect(() => {
    if (onCollectionUrlChange) {
      onCollectionUrlChange(collectionUrl);
    }
  }, [collectionUrl, onCollectionUrlChange]);

  function handleApiUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newUrl = event.target.value;
    setInputUrl(newUrl); // Update input state immediately for responsive UI
    // Update selected service if it matches a predefined service
    const matchingService = edrServices.find(service => service.value === newUrl);
    if (matchingService) {
      setSelectedService(newUrl);
    } else {
      setSelectedService(''); // Set to empty if it's a custom URL
    }
  }

  const handleServiceChange = (event: SelectChangeEvent) => {
    const newService = event.target.value;
    console.log('Service changed to:', newService);
    setSelectedService(newService);
    if (newService !== '') {
      console.log('Setting API URL to:', newService);
      setInputUrl(newService); // Update input immediately
      setApiUrl(newService); // Trigger validation immediately for dropdown selection
    }
    // If "Custom" is selected (empty value), don't change the apiUrl
  };

  // Force validation/refresh handler for the button
  const handleValidateClick = () => {
    // Set apiUrl to current inputUrl to trigger validation
    setApiUrl(inputUrl);
    // Increment trigger to force re-validation even if URL hasn't changed
    setValidationTrigger(prev => prev + 1);
  };

  // Helper function to build URL with query parameters
  const buildUrlWithParams = (baseUrl: string, format: string, parameters: string[], isDataQuery: boolean, coords: [number, number] | null = null, queryType: string = '') => {
    if (!baseUrl) return baseUrl;
    
    try {
      const url = new URL(baseUrl);
      
      // Only add query parameters if this is a data query URL (not a collection URL)
      if (isDataQuery) {
        if (format) {
          url.searchParams.set('f', format);
        } else {
          url.searchParams.delete('f');
        }
        
        // Add parameters as a single comma-separated parameter-name query param
        if (parameters && parameters.length > 0) {
          url.searchParams.set('parameter-name', parameters.join(','));
        } else {
          url.searchParams.delete('parameter-name');
        }
        
        // Add coords parameter if query type is 'position' and coords are available
        if (queryType.toLowerCase() === 'position' && coords) {
          const [lon, lat] = coords;
          url.searchParams.set('coords', `POINT(${lon.toFixed(3)} ${lat.toFixed(3)})`);
        } else {
          url.searchParams.delete('coords');
        }
      } else {
        // Remove query params when it's not a data query
        url.searchParams.delete('f');
        url.searchParams.delete('parameter-name');
        url.searchParams.delete('coords');
      }
      
      return url.toString();
    } catch (error) {
      // If URL is invalid, return as is
      return baseUrl;
    }
  };

  const handleItemClick = async (index: number, key: string) => {
    // Toggle collection: close if already open, open if closed (and close others)
    const newIndex = openCollectionIndex === index ? null : index;
    setOpenCollectionIndex(newIndex);
    setQueryUrl(apiUrl+"/"+key);
    
    // Find the collection and trigger extent change
    const collection = collections[index];
    
    // Update local state for selected collection
    const selectedColl = newIndex !== null ? collection : null;
    setSelectedCollection(selectedColl);
    
    // Find the "data" link from collection links
    if (selectedColl) {
      const dataLink = selectedColl.links.find(link => link.rel === 'data');
      let baseUrl = '';
      if (dataLink) {
        baseUrl = dataLink.href;
      } else {
        // Fallback to constructed URL if no data link found
        baseUrl = apiUrl + "/collections/" + key;
      }
      // Collection URL - no query params added (isDataQuery = false)
      setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, false, null, ''));
      setSelectedDataQuery(''); // Reset data query selection
      setSelectedParameters([]); // Reset parameters when collection changes
      if (onMapClick) {
        onMapClick(null); // Clear clicked coordinates when collection changes
      }
      if (onDataQueryChange) {
        onDataQueryChange(''); // Notify parent that data query was cleared
      }
    } else {
      setCollectionUrl('');
      setSelectedFormat(''); // Reset format when collection is deselected
      setSelectedParameters([]); // Reset parameters when collection is deselected
      if (onMapClick) {
        onMapClick(null); // Clear clicked coordinates
      }
    }
    
    // Notify parent about selected collection change
    if (onSelectedCollectionChange) {
      onSelectedCollectionChange(selectedColl);
    }
    
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
          if (normalizedBboxes && onCollectionExtentChange) {
            onCollectionExtentChange(normalizedBboxes);
          } else if (onCollectionExtentChange) {
            // normalizeBbox returned null, clear extent
            onCollectionExtentChange(null);
          }
        } catch (error) {
          console.warn('Error normalizing bbox:', error);
          if (onCollectionExtentChange) {
            onCollectionExtentChange(null);
          }
        }
      } else {
        // Clear extent if collection doesn't have valid bbox
        if (onCollectionExtentChange) {
          onCollectionExtentChange(null);
        }
      }
      
      // Check for location query support and execute if available
      if (collection && hasLocationQuery(collection) && onLocationFeaturesChange) {
        const locationQueryUrl = getLocationQueryUrl(collection);
        
        if (locationQueryUrl) {
          try {
            const locationResult = await executeLocationQuery(locationQueryUrl);
            if (locationResult && locationResult.features) {
              onLocationFeaturesChange(locationResult.features);
              setCurrentLocationCollection(collection.id); // Track which collection has location features
            } else {
              onLocationFeaturesChange(null);
              setCurrentLocationCollection(null);
            }
          } catch (error) {
            console.error('Error executing location query:', error);
            onLocationFeaturesChange(null);
            setCurrentLocationCollection(null);
          }
        }
      } else {
        if (onLocationFeaturesChange) {
          // Clear location features if collection doesn't support location queries
          onLocationFeaturesChange(null);
          setCurrentLocationCollection(null);
        }
      }
    } else {
      // Collection is being closed - clear all map data
      console.log('Collection being closed, clearing map data');
      if (onCollectionExtentChange) {
        onCollectionExtentChange(null);
      }
      if (onLocationFeaturesChange) {
        onLocationFeaturesChange(null);
        setCurrentLocationCollection(null);
      }
    }
  };



  const toggleValidationDetails = () => {
    setShowValidationDetails(!showValidationDetails);
  };

  return (
    <Box
      sx={{
        width: open ? 400 : 0,
        flexShrink: 0,
        transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1) 0ms',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <Paper 
        elevation={3}
        sx={{
          minWidth: 400, 
          width: 400,
          height: '100%', 
          overflow: 'auto',
          borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        }}
      >
        {/* EDR Service Selector and API URL - Moved to top */}
        <Box sx={{ padding: 2, minWidth: 120, borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="edr-service-select-label">EDR Service</InputLabel>
          <Select
            labelId="edr-service-select-label"
            id="edr-service-select"
            value={selectedService}
            label="EDR Service"
            onChange={handleServiceChange}
          >
            {edrServices.map((service) => (
              <MenuItem key={service.value} value={service.value}>
                {service.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField 
          fullWidth
          id="apiUrl" 
          label="API URL" 
          value={inputUrl}
          variant="outlined" 
          onChange={handleApiUrlChange}
          helperText="Validation will trigger 1 second after you stop typing"
        />
        <Button 
          variant="contained" 
          sx={{ mt: 1, mr: 1 }}
          disabled={isLoading}
          onClick={handleValidateClick}
        >
          {isLoading ? 'Loading...' : 'Validate'}
        </Button>
        <SwaggerUIViewer 
          serviceDescUrl={serviceDescUrl} 
          serviceName={landingPageTitle || undefined}
        />
        <ConformanceViewer 
          conformanceUrl={selectedConformanceUrl}
          onClose={() => setSelectedConformanceUrl(null)}
        />
        <SchemaInspector />
      </Box>
      
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
                <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(76, 175, 80, 0.08)', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 600, mb: 1 }}>
                    Conformance Classes
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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
                </Box>
              );
            }
            return null;
          })()}
          
          <Box sx={{ mb: 2 }}>
            {landingPageUrl && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Landing Page:</strong> {landingPageUrl}
              </div>
            )}
            {collectionsUrl && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Collections URL:</strong> {collectionsUrl}
              </div>
            )}
            {conformanceUrl && (
              <div>
                <strong>Conformance URL:</strong> {conformanceUrl}
              </div>
            )}
            {!landingPageUrl && !collectionsUrl && (
              <div>Current query URL: {queryUrl}</div>
            )}
          </Box>
          
          <ValidationResults 
            validation={validationResult} 
            expanded={showValidationDetails} 
          />
          
          {validationResult.errors && validationResult.errors.length > 0 && (
            <Button 
              variant="outlined" 
              size="small" 
              onClick={toggleValidationDetails}
              sx={{ mb: 2 }}
            >
              {showValidationDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          )}
        </CardContent>
      </Card>
      
      <List component="nav">
                    {isLoading ? (
              <Alert severity="info">Loading collections...</Alert>
            ) : collections.length === 0 ? (
              validationResult.errors && validationResult.errors.length > 0 ? (
                validationResult.errors.map((error, index) => (
                  <Alert 
                    key={index} 
                    severity={error.type === 'cors' ? 'warning' : 'error'}
                  >
                    <AlertTitle>
                      {error.type === 'cors' ? 'CORS Issue' : 'Error'}
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
              ) : (
                <Alert severity="warning">No collections found from this endpoint.</Alert>
              )
            ) : (
              <Alert severity="success">Found {collections.length} collections</Alert>
            )}
            {collections.map((collection, index) => (
          <React.Fragment key={collection.id || index}>
            <ListItemButton onClick={() => handleItemClick(index, collection.id)}>
              <ListItemIcon>
                <LayersIcon />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <div>
                    {/* Data Query Type Badges - First row */}
                    {getSupportedDataQueries(collection).length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        gap: '4px', 
                        flexWrap: 'wrap',
                        marginBottom: '6px'
                      }}>
                        {getSupportedDataQueries(collection).map((queryType) => (
                          <Chip
                            key={queryType}
                            label={queryType.toUpperCase()}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ 
                              height: '18px',
                              fontSize: '0.6rem',
                              fontWeight: 'bold',
                              borderWidth: '1px',
                              '& .MuiChip-label': {
                                padding: '0 5px'
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {/* Collection Title - Second row */}
                    <div style={{ 
                      fontSize: '1rem',
                      fontWeight: 500,
                      lineHeight: 1.3
                    }}>
                      {collection.title ? collection.title : collection.id}
                    </div>
                  </div>
                }
                primaryTypographyProps={{ component: 'div' }}
                secondary={
                  <>
                    {collection.description && <span>{collection.description}</span>}
                    {collection.title && collection.id && (
                      <span style={{ 
                        fontSize: '0.875rem', 
                        color: 'rgba(0, 0, 0, 0.6)', 
                        display: 'block', 
                        marginTop: collection.description ? '4px' : '0' 
                      }}>
                        ID: {collection.id}
                      </span>
                    )}
                    {/* Temporal Extent Intervals */}
                    {collection.extent?.temporal && (() => {
                      const normalizedTemporal = normalizeTemporal(collection.extent.temporal);
                      if (normalizedTemporal && normalizedTemporal.intervals.length > 0) {
                        return (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 600,
                              color: 'rgba(0, 0, 0, 0.7)',
                              marginBottom: '4px'
                            }}>
                              Temporal Intervals:
                            </div>
                            {normalizedTemporal.intervals.map((interval, idx) => (
                              <div 
                                key={idx}
                                style={{ 
                                  fontSize: '0.7rem', 
                                  color: 'rgba(0, 0, 0, 0.6)',
                                  fontFamily: 'monospace',
                                  paddingLeft: '8px',
                                  marginBottom: '2px'
                                }}
                              >
                                [{interval[0] === null ? 'null' : interval[0]}, {interval[1] === null ? 'null' : interval[1]}]
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* Extent Type Badges - Last row */}
                    {(() => {
                      const standardExtentBadges: { label: string; color: 'secondary' | 'info' }[] = [];
                      const customExtentBadges: { label: string; color: 'secondary' | 'info' }[] = [];
                      
                      // Check for spatial extent
                      if (collection.extent?.spatial?.bbox && 
                          Array.isArray(collection.extent.spatial.bbox) && 
                          collection.extent.spatial.bbox.length > 0) {
                        standardExtentBadges.push({ label: 'Spatial', color: 'secondary' });
                      }
                      // Check for temporal extent
                      if (collection.extent?.temporal && 
                          (collection.extent.temporal.interval || collection.extent.temporal.values)) {
                        standardExtentBadges.push({ label: 'Temporal', color: 'secondary' });
                      }
                      // Check for vertical extent
                      if (collection.extent?.vertical && 
                          (collection.extent.vertical.interval || collection.extent.vertical.values)) {
                        standardExtentBadges.push({ label: 'Vertical', color: 'secondary' });
                      }
                      // Check for custom dimensions
                      if (collection.extent?.custom && Array.isArray(collection.extent.custom)) {
                        collection.extent.custom.forEach((customDim) => {
                          if (customDim.id) {
                            customExtentBadges.push({ 
                              label: customDim.id, 
                              color: 'info' 
                            });
                          }
                        });
                      }
                      
                      const allBadges = [...standardExtentBadges, ...customExtentBadges];
                      
                      return allBadges.length > 0 ? (
                        <div style={{ 
                          display: 'flex', 
                          gap: '4px', 
                          flexWrap: 'wrap',
                          marginTop: '8px'
                        }}>
                          {allBadges.map((badge, idx) => (
                            <Chip
                              key={`${badge.label}-${idx}`}
                              label={badge.label}
                              size="small"
                              color={badge.color}
                              variant="filled"
                              sx={{ 
                                height: '18px',
                                fontSize: '0.6rem',
                                fontWeight: 'bold',
                                '& .MuiChip-label': {
                                  padding: '0 5px'
                                }
                              }}
                            />
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </>
                }
                secondaryTypographyProps={{ component: 'div' }}
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
                        // Notify parent about data query change
                        if (onDataQueryChange) {
                          onDataQueryChange(queryType);
                        }
                        // Clear clicked coordinates when changing data query
                        if (queryType.toLowerCase() !== 'position' && onMapClick) {
                          onMapClick(null);
                        }
                        let baseUrl = '';
                        if (queryType && collection.data_queries[queryType]?.link) {
                          baseUrl = collection.data_queries[queryType].link.href;
                        } else {
                          // Reset to data link
                          const dataLink = collection.links.find(link => link.rel === 'data');
                          if (dataLink) {
                            baseUrl = dataLink.href;
                          }
                        }
                        // Apply format and parameter if data query is selected
                        const isDataQuery = !!queryType;
                        setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, queryType));
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
                { typeof collection.output_formats !== "undefined" && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="format-select-label">Output Format</InputLabel>
                    <Select
                      labelId="format-select-label"
                      value={selectedFormat}
                      label="Output Format"
                      onChange={(e) => {
                        const format = e.target.value;
                        setSelectedFormat(format);
                        // Update URL with format parameter while preserving current base URL
                        // Only add params if data query is selected
                        const isDataQuery = !!selectedDataQuery;
                        setCollectionUrl(buildUrlWithParams(collectionUrl, format, selectedParameters, isDataQuery, clickedCoords, selectedDataQuery));
                      }}
                      size="small"
                    >
                      <MenuItem value="">
                        <em>Select a format</em>
                      </MenuItem>
                      {collection.output_formats.map((format) => (
                        <MenuItem key={format} value={format}>
                          {format}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

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
                        // Update URL with parameter-name parameter
                        // Only add params if data query is selected
                        const isDataQuery = !!selectedDataQuery;
                        setCollectionUrl(buildUrlWithParams(collectionUrl, selectedFormat, parameters, isDataQuery, clickedCoords, selectedDataQuery));
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

                {/* Location Query Info */}
                {hasLocationQuery(collection) && (
                  <>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <AlertTitle>Location Query Available</AlertTitle>
                      This collection supports location queries. Location features will be displayed on the map when this collection is selected.
                    </Alert>
                    
                    {/* Show location features list only for the current collection */}
                    {currentLocationCollection === collection.id && locationFeatures && (
                      <Box sx={{ mt: 1 }}>
                        <LocationFeatureList 
                          features={locationFeatures} 
                          onFeatureSelect={onFeatureSelect}
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
                : <Alert severity="success"><AlertTitle>E: LINKS</AlertTitle>{collection.links.map((link, i) => (<div key={i}><Link href={link.href}>{link.title ? link.title : link.rel}</Link> ({link.rel})</div> ))}</Alert>
              }

              { typeof collection.data_queries == "undefined"
                ? <Alert severity="error"><AlertTitle>F: DATA_QUERIES</AlertTitle>Every collection within a collections array MUST have a data_queries parameter.</Alert>
                : (
                  <Alert severity="success">
                    <AlertTitle>F: DATA_QUERIES</AlertTitle>
                    {Object.keys(collection.data_queries).filter(key => collection.data_queries[key]?.link?.href).map((key) => (
                      <div key={key}>
                        <Link href={collection.data_queries[key].link.href}>
                          {collection.data_queries[key].link.title ? collection.data_queries[key].link.title : collection.data_queries[key].link.rel}
                        </Link> ({collection.data_queries[key].link.rel})
                      </div>
                    ))}
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
              
              { typeof collection.output_formats == "undefined" 
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