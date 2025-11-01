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
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import React, { useEffect, useState } from 'react';
import { getCollections, Collection, ValidationResult, normalizeBbox, hasLocationQuery, getLocationQueryUrl, executeLocationQuery, getSupportedDataQueries, normalizeTemporal, formatConformanceClass } from './DataRetrievalAPI';
import FormatForm from './FormatForm';
import ParameterForm from './ParameterForm';
import QueryForm from './QueryForm';
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

const Sidebar = ({ open, onClose, boundingBox, setBoundingBox, onCollectionExtentChange, onLocationFeaturesChange, onFeatureSelect, onSelectedCollectionChange, locationFeatures }: SidebarProps) => {
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
  const [queryDrawerOpen, setQueryDrawerOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedDataQuery, setSelectedDataQuery] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [collectionUrl, setCollectionUrl] = useState<string>('');

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
  const buildUrlWithParams = (baseUrl: string, format: string) => {
    if (!baseUrl) return baseUrl;
    
    try {
      const url = new URL(baseUrl);
      if (format) {
        url.searchParams.set('f', format);
      } else {
        url.searchParams.delete('f');
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
      // Apply current format if selected
      setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat));
      setSelectedDataQuery(''); // Reset data query selection
    } else {
      setCollectionUrl('');
      setSelectedFormat(''); // Reset format when collection is deselected
    }
    
    // Open query drawer if collection is selected
    if (selectedColl) {
      setQueryDrawerOpen(true);
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
    <React.Fragment>
      <Paper style={{minWidth: 200, maxHeight: '100vh', overflow: 'auto'}}>
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
              />
              {openCollectionIndex === index ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={openCollectionIndex === index} timeout="auto" unmountOnExit>
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
                  <>
                    {/* Data Query Selector */}
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="data-query-select-label">Data Query</InputLabel>
                      <Select
                        labelId="data-query-select-label"
                        value={selectedDataQuery}
                        label="Data Query"
                        onChange={(e) => {
                          const queryType = e.target.value;
                          setSelectedDataQuery(queryType);
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
                          // Apply current format to the URL
                          setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat));
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
                  </>
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
                  <>
                    {/* Format Selector */}
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
                          setCollectionUrl(buildUrlWithParams(collectionUrl, format));
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
                    
                    {/* Schema validation errors specific to output_formats */}
                    {validationResult.collectionErrors && validationResult.collectionErrors[collection.id] && (
                      <CollectionValidationErrors 
                        collectionId={collection.id}
                        errors={validationResult.collectionErrors[collection.id]}
                        section="output_formats"
                        expanded={false}
                      />
                    )}
                  </>
                )
              }

              { typeof collection.parameter_names == "undefined"
                ? <Alert severity="error"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>Every collection within a collections array MUST have a parameter_names parameter.</Alert>
                : (
                  <>
                    <ParameterForm queryUrl={queryUrl} parameters={collection.parameter_names} setQueryUrl={setQueryUrl}/> 
                    {/* Schema validation errors specific to parameter_names */}
                    {validationResult.collectionErrors && validationResult.collectionErrors[collection.id] && (
                      <CollectionValidationErrors 
                        collectionId={collection.id}
                        errors={validationResult.collectionErrors[collection.id]}
                        section="parameter_names"
                        expanded={false}
                      />
                    )}
                  </>
                )
              }
            </Collapse>
          </React.Fragment>
        ))}
      </List>
    </Paper>
    
    {/* Bottom Drawer for Query Builder */}
      <Drawer
        anchor="bottom"
        open={queryDrawerOpen}
        onClose={() => setQueryDrawerOpen(false)}
        variant="persistent"
        sx={{
          '& .MuiDrawer-paper': {
            height: '120px',
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h6">Query Builder</Typography>
            <IconButton onClick={() => setQueryDrawerOpen(false)} size="small">
              <KeyboardArrowDownIcon />
            </IconButton>
          </Box>
          
          {selectedCollection && collectionUrl ? (
            <Box>
              {/* Collection URL with Copy Button */}
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                {selectedDataQuery ? `${selectedDataQuery} URL` : 'Collection URL'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  fullWidth
                  value={collectionUrl}
                  size="small"
                  InputProps={{
                    readOnly: true,
                    sx: { fontSize: '0.875rem' }
                  }}
                />
                <IconButton
                  onClick={() => {
                    navigator.clipboard.writeText(collectionUrl);
                  }}
                  size="small"
                  color="primary"
                  title="Copy URL"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a collection to view URL
            </Typography>
          )}
        </Box>
      </Drawer>    {/* Toggle button to show drawer when closed */}
    {!queryDrawerOpen && selectedCollection && (
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          right: '50%',
          transform: 'translateX(50%)',
          zIndex: 1200,
        }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={() => setQueryDrawerOpen(true)}
          startIcon={<KeyboardArrowUpIcon />}
          sx={{ borderRadius: '8px 8px 0 0' }}
        >
          Query Builder
        </Button>
      </Box>
    )}
    </React.Fragment>
  );
};

export default Sidebar;