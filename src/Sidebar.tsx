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
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import React, { useEffect, useState } from 'react';
import { getCollections, Collection, ValidationResult, normalizeBbox, hasLocationQuery, getLocationQueryUrl, executeLocationQuery } from './DataRetrievalAPI';
import FormatForm from './FormatForm';
import ParameterForm from './ParameterForm';
import QueryForm from './QueryForm';
import ValidationResults from './ValidationResult';
import SchemaInspector from './SchemaInspector';
import LocationFeatureList from './LocationFeatureList';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';

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
  { label: 'FMI Open Data', value: 'https://opendata.fmi.fi/edr/collections' },
  { label: 'SWIM Met Norway', value: 'https://swim.met.no/collections' },
  { label: 'Norwegian Met Office Isobaric', value: 'https://edrisobaric.k8s.met.no/collections' },
  { label: 'SWIM iblsoft (Test empty bbox)', value: 'https://swim.iblsoft.com/edr/collections' },
  { label: 'Met Office Labs', value: 'https://labs.metoffice.gov.uk/edr/collections' },
  { label: 'Aviation Weather (WIFS)', value: 'https://aviationweather.gov/wifs/api/collections?f=json' },
  { label: 'Meteogate Observations', value: 'https://observations.meteogate.eu/collections' },
  { label: 'SmartMet Kenya', value: 'https://data-kenya.smartmet.org/edr/collections' },
  { label: 'DWD WIS2 GDC', value: 'https://wis2.dwd.de/gdc/collections' },
  { label: 'Custom', value: '' }
];

const Sidebar = ({ open, onClose, boundingBox, setBoundingBox, onCollectionExtentChange, onLocationFeaturesChange, onFeatureSelect, onSelectedCollectionChange, locationFeatures }: SidebarProps) => {
  const [apiUrl, setApiUrl] = useState('https://opendata.fmi.fi/edr/collections');
  const [selectedService, setSelectedService] = useState('https://opendata.fmi.fi/edr/collections');
  const [queryUrl, setQueryUrl] = useState('https://opendata.fmi.fi/edr/collections');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true, errors: null });
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocationCollection, setCurrentLocationCollection] = useState<string | null>(null);

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
        
        if (result.collections && result.collections.length > 0) {
          // Log which collections have location queries
          try {
            const collectionsWithLocations = result.collections.filter(c => hasLocationQuery(c));
            console.log(`Collections with location queries: ${collectionsWithLocations.length}`, 
              collectionsWithLocations.map(c => c.id));
          } catch (filterError) {
            console.warn('Error filtering collections with location queries:', filterError);
          }
        }
        
        // Update validation result
        setValidationResult(result.validation);
        
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
  }, [apiUrl]);

  const [openCollectionIndex, setOpenCollectionIndex] = useState<number | null>(null);

  function handleApiUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newUrl = event.target.value;
    setApiUrl(newUrl);
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
      setApiUrl(newService);
    }
    // If "Custom" is selected (empty value), don't change the apiUrl
  };

  const handleItemClick = async (index: number, key: string) => {
    // Toggle collection: close if already open, open if closed (and close others)
    const newIndex = openCollectionIndex === index ? null : index;
    setOpenCollectionIndex(newIndex);
    setQueryUrl(apiUrl+"/"+key);
    
    // Find the collection and trigger extent change
    const collection = collections[index];
    console.log('handleItemClick called with collection:', collection?.id, 'data_queries:', collection?.data_queries);
    
    // Notify parent about selected collection change
    if (onSelectedCollectionChange) {
      onSelectedCollectionChange(newIndex !== null ? collection : null);
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
      console.log('Checking collection for location query support:', collection?.id);
      if (collection && hasLocationQuery(collection) && onLocationFeaturesChange) {
        console.log('Collection supports location queries, executing...');
        const locationQueryUrl = getLocationQueryUrl(collection);
        console.log('Location query URL:', locationQueryUrl);
        
        if (locationQueryUrl) {
          try {
            const locationResult = await executeLocationQuery(locationQueryUrl);
            if (locationResult && locationResult.features) {
              console.log(`Found ${locationResult.features.length} location features`);
              onLocationFeaturesChange(locationResult.features);
              setCurrentLocationCollection(collection.id); // Track which collection has location features
            } else {
              console.log('No location features returned');
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
        console.log('Collection does not support location queries or callback not available');
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
    <Paper style={{minWidth: 200, maxHeight: '100vh', overflow: 'auto'}}>
      <Card sx={{ minWidth: 275 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            Current query URL: {queryUrl}
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
      
      <Box sx={{ padding: 1, minWidth: 120 }}>
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
          sx={{ padding: 1, width: '90%' }} 
          id="apiUrl" 
          label="API URL" 
          value={apiUrl}
          variant="outlined" 
          onChange={handleApiUrlChange}
        />
        <Button 
          variant="contained" 
          sx={{ mt: 1, mr: 1 }}
          disabled={isLoading}
          onClick={() => getCollections(apiUrl)}
        >
          {isLoading ? 'Loading...' : 'Validate'}
        </Button>
        <SchemaInspector />
      </Box>
      
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{collection.title ? collection.title : collection.id}</span>
                    {hasLocationQuery(collection) && (
                      <span 
                        style={{ 
                          backgroundColor: '#2196F3', 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }}
                      >
                        LOCATIONS
                      </span>
                    )}
                  </div>
                }
                secondary={collection.description ? collection.description : null} 
              />
              {openCollectionIndex === index ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={openCollectionIndex === index} timeout="auto" unmountOnExit>
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
                    <QueryForm queryUrl={queryUrl} queries={collection.data_queries} setQueryUrl={setQueryUrl}/> 
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
                : <FormatForm queryUrl={queryUrl} formats={collection.output_formats} setQueryUrl={setQueryUrl}/> 
              }

              { typeof collection.parameter_names == "undefined"
                ? <Alert severity="error"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>Every collection within a collections array MUST have a parameter_names parameter.</Alert>
                : <ParameterForm queryUrl={queryUrl} parameters={collection.parameter_names} setQueryUrl={setQueryUrl}/> 
              }
            </Collapse>
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
};

export default Sidebar;