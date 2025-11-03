import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
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
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useEffect, useState, useMemo } from 'react';
import { getCollections, Collection, ValidationResult, normalizeBbox, hasLocationQuery, getLocationQueryUrl, executeLocationQuery, getSupportedDataQueries, normalizeTemporal, formatConformanceClass, expandTemporalValues } from './DataRetrievalAPI';
import ValidationResults from './ValidationResult';
import SchemaInspector from './SchemaInspector';
import LocationFeatureList from './LocationFeatureList';
import TemporalExtent from './TemporalExtent';
import VerticalExtent from './VerticalExtent';
import CollectionValidationErrors from './CollectionValidationErrors';
import SwaggerUIViewer from './SwaggerUIViewer';
import ConformanceViewer from './ConformanceViewer';
import { CustomService } from './SettingsDrawer';

interface SidebarProps {
  open: boolean;
  boundingBox: [number, number, number, number];
  setBoundingBox: any;
  onClose: () => void;
  onCollectionExtentChange?: (extents: [number, number, number, number][] | null) => void;
  onLocationFeaturesChange?: (features: any[] | null) => void;
  onFeatureSelect?: (feature: any) => void;
  onSelectedCollectionChange?: (collection: Collection | null) => void;
  onMapClick?: (coords: [number, number][]) => void;
  onDataQueryChange?: (dataQuery: string) => void;
  onCollectionUrlChange?: (url: string) => void;
  clickedCoords?: [number, number][];
  selectedArea?: [number, number][][];
  radiusKm?: number;
  locationFeatures?: any[] | null;
  selectedFeature?: any | null;
  customServices?: CustomService[];
  onServiceUrlSelect?: string | null;
  onGeoJsonLayersChange?: (layers: {url: string, title: string, visible: boolean, labelProperty?: string, data?: any}[]) => void;
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
  { label: 'DMI (Denmark)', value: 'https://api.meteogate.eu/dk/edr' },
  { label: 'DWD WIS2 GDC', value: 'https://wis2.dwd.de/gdc/' },
  { label: 'Canada WIS2 GDC', value: 'https://wis2-gdc.weather.gc.ca' },
  { label: 'China WIS2 GDC', value: 'https://gdc.wis.cma.cn' },
  { label: 'Custom', value: '' }
];

const Sidebar = ({ open, onClose, boundingBox, setBoundingBox, onCollectionExtentChange, onLocationFeaturesChange, onFeatureSelect, onSelectedCollectionChange, onMapClick, onDataQueryChange, onCollectionUrlChange, clickedCoords, selectedArea, radiusKm, locationFeatures, selectedFeature, customServices = [], onServiceUrlSelect = null, onGeoJsonLayersChange }: SidebarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // Mobile/tablet breakpoint at 900px
  const sidebarWidth = isMobile ? '100%' : 480;
  
  const [apiUrl, setApiUrl] = useState('https://opendata.fmi.fi/edr');
  const [selectedService, setSelectedService] = useState('https://opendata.fmi.fi/edr');
  const [inputUrl, setInputUrl] = useState('https://opendata.fmi.fi/edr'); // Separate state for text input
  const [queryUrl, setQueryUrl] = useState('https://opendata.fmi.fi/edr');

  // Effect to handle external service URL selection (from settings)
  useEffect(() => {
    if (onServiceUrlSelect) {
      setSelectedService(onServiceUrlSelect);
      setInputUrl(onServiceUrlSelect);
      setApiUrl(onServiceUrlSelect);
    }
  }, [onServiceUrlSelect]);

  // Combine system services with custom services
  const allServices = useMemo(() => {
    const customServiceItems = customServices.map(service => ({
      label: service.name,
      value: service.url,
      isCustom: true
    }));
    
    return [
      ...edrServices.filter(s => s.value !== ''), // System services except "Custom"
      ...customServiceItems,
      { label: 'Custom', value: '', isCustom: false } // Keep "Custom" at the end
    ];
  }, [customServices]);
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
  const [selectedDatetimes, setSelectedDatetimes] = useState<string[]>([]);
  const [datetimeMode, setDatetimeMode] = useState<'individual' | 'range'>('individual');
  const [startDatetime, setStartDatetime] = useState<string>('');
  const [endDatetime, setEndDatetime] = useState<string>('');
  const [collectionUrl, setCollectionUrl] = useState<string>('');
  const [showCollectionValidation, setShowCollectionValidation] = useState<{[key: string]: boolean}>({});
  const [activeGeoJsonLayers, setActiveGeoJsonLayers] = useState<{url: string, title: string, visible: boolean, labelProperty?: string, data?: any}[]>([]);

  // Helper function to extract GeoJSON links from a collection
  const getGeoJsonLinks = (collection: Collection): {url: string, title: string}[] => {
    if (!collection || !collection.links || !Array.isArray(collection.links)) {
      return [];
    }
    
    // Check if collection has temporal extent
    const hasTemporal = collection.extent?.temporal && 
                        (collection.extent.temporal.interval || collection.extent.temporal.values);
    
    // Get current timestamp in ISO format (rounded to current hour)
    const now = new Date();
    now.setMinutes(0, 0, 0); // Round to current hour
    const datetime = now.toISOString().replace(/\.\d{3}Z$/, 'Z'); // Format: 2025-11-01T06:00Z
    
    return collection.links
      .filter(link => link.type === 'application/geo+json')
      .map(link => {
        let url = link.href;
        
        // Add datetime parameter if collection has temporal extent
        if (hasTemporal) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}datetime=${datetime}`;
        }
        
        return {
          url: url,
          title: link.title || link.rel || 'GeoJSON Layer'
        };
      });
  };

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
      
      // Reset all query-related states when service changes
      setSelectedCollection(null);
      setSelectedDataQuery('');
      setSelectedFormat('');
      setSelectedParameters([]);
      setSelectedDatetimes([]);
      setDatetimeMode('individual');
      setStartDatetime('');
      setEndDatetime('');
      setCollectionUrl('');
      setActiveGeoJsonLayers([]);
      
      // Clear GeoJSON layers
      if (onGeoJsonLayersChange) {
        onGeoJsonLayersChange([]);
      }
      
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
        if (onMapClick) {
          onMapClick([]);
        }
        if (onDataQueryChange) {
          onDataQueryChange('');
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
        setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, null, radiusKm, selectedDataQuery, null, selectedDatetimes, datetimeMode, startDatetime, endDatetime));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedCoords]);

  // Effect to rebuild URL when selected area changes
  useEffect(() => {
    if (selectedDataQuery && selectedDataQuery.toLowerCase() === 'area' && selectedArea) {
      const isDataQuery = !!selectedDataQuery;
      // Find the current collection and rebuild the URL
      if (selectedCollection && selectedCollection.data_queries[selectedDataQuery]?.link) {
        const baseUrl = selectedCollection.data_queries[selectedDataQuery].link.href;
        setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, null, selectedArea, radiusKm, selectedDataQuery, null, selectedDatetimes, datetimeMode, startDatetime, endDatetime));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea]);

  // Effect to rebuild URL when radius query coordinates or radius change
  useEffect(() => {
    if (selectedDataQuery && selectedDataQuery.toLowerCase() === 'radius') {
      const isDataQuery = !!selectedDataQuery;
      // Find the current collection and rebuild the URL
      if (selectedCollection && selectedCollection.data_queries[selectedDataQuery]?.link) {
        const baseUrl = selectedCollection.data_queries[selectedDataQuery].link.href;
        setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, null, radiusKm, selectedDataQuery, null, selectedDatetimes, datetimeMode, startDatetime, endDatetime));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedCoords, radiusKm]);

  // Effect to rebuild URL when selected location feature changes
  useEffect(() => {
    if (selectedDataQuery && selectedDataQuery.toLowerCase() === 'locations' && selectedFeature) {
      const isDataQuery = !!selectedDataQuery;
      // Find the current collection and rebuild the URL
      if (selectedCollection && selectedCollection.data_queries[selectedDataQuery]?.link) {
        const baseUrl = selectedCollection.data_queries[selectedDataQuery].link.href;
        setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, null, null, radiusKm, selectedDataQuery, selectedFeature, selectedDatetimes, datetimeMode, startDatetime, endDatetime));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeature]);

  // Effect to rebuild URL when selected datetime changes
  useEffect(() => {
    if (selectedDataQuery && selectedCollection) {
      const isDataQuery = !!selectedDataQuery;
      if (selectedCollection.data_queries[selectedDataQuery]?.link) {
        const baseUrl = selectedCollection.data_queries[selectedDataQuery].link.href;
        const locationFeature = selectedDataQuery.toLowerCase() === 'locations' ? selectedFeature : null;
        setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, selectedArea, radiusKm, selectedDataQuery, locationFeature, selectedDatetimes, datetimeMode, startDatetime, endDatetime));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatetimes]);

  // Effect to notify parent when URL changes
  useEffect(() => {
    if (onCollectionUrlChange) {
      onCollectionUrlChange(collectionUrl);
    }
  }, [collectionUrl, onCollectionUrlChange]);

  function handleApiUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newUrl = event.target.value;
    setInputUrl(newUrl); // Update input state immediately for responsive UI
    // Update selected service if it matches a predefined service (system or custom)
    const matchingService = allServices.find(service => service.value === newUrl);
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
  const buildUrlWithParams = (
    baseUrl: string, 
    format: string, 
    parameters: string[], 
    isDataQuery: boolean, 
    coords: [number, number][] | null | undefined = null, 
    area: [number, number][][] | null | undefined = null, 
    radius: number | undefined = undefined, 
    queryType: string = '', 
    locationFeature: any | null = null, 
    datetimes: string[] = [],
    dtMode: 'individual' | 'range' = 'individual',
    dtStart: string = '',
    dtEnd: string = ''
  ) => {
    if (!baseUrl) return baseUrl;
    
    try {
      let url = new URL(baseUrl);
      
      // Handle location query type - add location ID or use href from feature
      if (queryType.toLowerCase() === 'locations' && locationFeature) {
        // First, check if the feature has an href property
        if (locationFeature.properties?.href) {
          // Use the href from the feature properties as the complete URL
          url = new URL(locationFeature.properties.href);
        } else if (locationFeature.id) {
          // If no href, append the location ID to the base URL path (only if not already present)
          const pathParts = url.pathname.split('/').filter(part => part.length > 0);
          const locationId = String(locationFeature.id);
          // Check if the location ID is not already the last part of the path
          if (pathParts[pathParts.length - 1] !== locationId) {
            pathParts.push(locationId);
            url.pathname = '/' + pathParts.join('/');
          }
        }
      }
      
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
        
        // Add datetime parameter
        if (dtMode === 'range' && dtStart && dtEnd) {
          // Time range mode: format as start/end
          url.searchParams.set('datetime', `${dtStart}/${dtEnd}`);
        } else if (dtMode === 'individual' && datetimes && datetimes.length > 0) {
          // Individual times mode: comma-separated list
          url.searchParams.set('datetime', datetimes.join(','));
        } else {
          url.searchParams.delete('datetime');
        }
        
        // Add coords parameter
        if (queryType.toLowerCase() === 'position' && coords && coords.length > 0) {
          if (coords.length === 1) {
            // Single POINT
            const [lon, lat] = coords[0];
            url.searchParams.set('coords', `POINT(${lon.toFixed(3)} ${lat.toFixed(3)})`);
          } else {
            // MULTIPOINT
            const points = coords.map(c => `(${c[0].toFixed(3)} ${c[1].toFixed(3)})`).join(',');
            url.searchParams.set('coords', `MULTIPOINT(${points})`);
          }
        } else if (queryType.toLowerCase() === 'radius' && coords && coords.length > 0) {
          // Radius query uses POINT/MULTIPOINT like position
          if (coords.length === 1) {
            // Single POINT
            const [lon, lat] = coords[0];
            url.searchParams.set('coords', `POINT(${lon.toFixed(3)} ${lat.toFixed(3)})`);
          } else {
            // MULTIPOINT
            const points = coords.map(c => `(${c[0].toFixed(3)} ${c[1].toFixed(3)})`).join(',');
            url.searchParams.set('coords', `MULTIPOINT(${points})`);
          }
          // Add radius parameters
          if (radius !== undefined) {
            url.searchParams.set('within', radius.toString());
            url.searchParams.set('within-units', 'km');
          }
        } else if (queryType.toLowerCase() === 'area' && area && area.length > 0) {
          if (area.length === 1) {
            // Single POLYGON
            const wktCoords = area[0].map(coord => `${coord[0].toFixed(2)} ${coord[1].toFixed(2)}`).join(',');
            url.searchParams.set('coords', `POLYGON((${wktCoords}))`);
          } else {
            // MULTIPOLYGON
            const polygons = area.map(polygon => {
              const wktCoords = polygon.map(coord => `${coord[0].toFixed(2)} ${coord[1].toFixed(2)}`).join(',');
              return `((${wktCoords}))`;
            }).join(',');
            url.searchParams.set('coords', `MULTIPOLYGON(${polygons})`);
          }
        } else if (queryType.toLowerCase() !== 'locations') {
          // Don't delete coords for location queries
          url.searchParams.delete('coords');
          url.searchParams.delete('within');
          url.searchParams.delete('within-units');
        }
      } else {
        // Remove query params when it's not a data query
        url.searchParams.delete('f');
        url.searchParams.delete('parameter-name');
        url.searchParams.delete('datetime');
        url.searchParams.delete('coords');
        url.searchParams.delete('within');
        url.searchParams.delete('within-units');
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
    
    // Initialize GeoJSON layers for the selected collection
    if (selectedColl) {
      const geoJsonLinks = getGeoJsonLinks(selectedColl);
      const initialLayers = geoJsonLinks.map(link => ({
        url: link.url,
        title: link.title,
        visible: false // Initially hidden
      }));
      setActiveGeoJsonLayers(initialLayers);
      if (onGeoJsonLayersChange) {
        onGeoJsonLayersChange(initialLayers);
      }
    } else {
      // Clear GeoJSON layers when collection is closed
      setActiveGeoJsonLayers([]);
      if (onGeoJsonLayersChange) {
        onGeoJsonLayersChange([]);
      }
    }
    
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
      setCollectionUrl(buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, false, null, null, radiusKm, '', null, [], 'individual', '', ''));
      setSelectedDataQuery(''); // Reset data query selection
      setSelectedParameters([]); // Reset parameters when collection changes
      setSelectedDatetimes([]); // Reset datetime selection when collection changes
      setDatetimeMode('individual'); // Reset datetime mode
      setStartDatetime(''); // Reset start datetime
      setEndDatetime(''); // Reset end datetime
      if (onMapClick) {
        onMapClick([]); // Clear clicked coordinates when collection changes
      }
      if (onDataQueryChange) {
        onDataQueryChange(''); // Notify parent that data query was cleared
      }
    } else {
      setCollectionUrl('');
      setSelectedFormat(''); // Reset format when collection is deselected
      setSelectedParameters([]); // Reset parameters when collection is deselected
      if (onMapClick) {
        onMapClick([]); // Clear clicked coordinates
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
      // Clear GeoJSON layers when collection is closed
      setActiveGeoJsonLayers([]);
      if (onGeoJsonLayersChange) {
        onGeoJsonLayersChange([]);
      }
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
            {allServices.map((service) => (
              <MenuItem key={service.value || 'custom'} value={service.value}>
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
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      lineHeight: 1.3,
                      marginBottom: '6px'
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
                      <Box 
                        component="span"
                        sx={{ 
                          fontSize: '0.875rem', 
                          color: 'text.secondary',
                          display: 'block', 
                          marginTop: collection.description ? '4px' : '0' 
                        }}
                      >
                        ID: {collection.id}
                      </Box>
                    )}
                    {collection.itemType && (
                      <Box 
                        component="span"
                        sx={{ 
                          fontSize: '0.875rem', 
                          color: 'text.secondary',
                          display: 'block', 
                          marginTop: '4px',
                          fontWeight: 500
                        }}
                      >
                        Item Type: {collection.itemType}
                      </Box>
                    )}
                    {/* Temporal Extent Intervals */}
                    {collection.extent?.temporal && (() => {
                      const normalizedTemporal = normalizeTemporal(collection.extent.temporal);
                      if (normalizedTemporal && normalizedTemporal.intervals.length > 0) {
                        return (
                          <Box sx={{ marginTop: '8px' }}>
                            <Box sx={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 600,
                              color: 'text.secondary',
                              marginBottom: '4px'
                            }}>
                              Temporal Intervals:
                            </Box>
                            {normalizedTemporal.intervals.map((interval, idx) => (
                              <Box 
                                key={idx}
                                sx={{ 
                                  fontSize: '0.7rem', 
                                  color: 'text.secondary',
                                  fontFamily: 'monospace',
                                  paddingLeft: '8px',
                                  marginBottom: '2px'
                                }}
                              >
                                [{interval[0] === null ? 'null' : interval[0]}, {interval[1] === null ? 'null' : interval[1]}]
                              </Box>
                            ))}
                          </Box>
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
                          onMapClick([]);
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
                        const locationFeature = queryType.toLowerCase() === 'locations' ? selectedFeature : null;
                        const newUrl = buildUrlWithParams(baseUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, selectedArea, radiusKm, queryType, locationFeature, selectedDatetimes, datetimeMode, startDatetime, endDatetime);
                        setCollectionUrl(newUrl);
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
                        const locationFeature = selectedDataQuery.toLowerCase() === 'locations' ? selectedFeature : null;
                        setCollectionUrl(buildUrlWithParams(collectionUrl, format, selectedParameters, isDataQuery, clickedCoords, selectedArea, radiusKm, selectedDataQuery, locationFeature, selectedDatetimes, datetimeMode, startDatetime, endDatetime));
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
                        const locationFeature = selectedDataQuery.toLowerCase() === 'locations' ? selectedFeature : null;
                        setCollectionUrl(buildUrlWithParams(collectionUrl, selectedFormat, parameters, isDataQuery, clickedCoords, selectedArea, radiusKm, selectedDataQuery, locationFeature, selectedDatetimes, datetimeMode, startDatetime, endDatetime));
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
                  return temporalValues.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      {/* Datetime Mode Selector */}
                      <FormControl component="fieldset" sx={{ mb: 1 }}>
                        <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>Date/Time Selection</FormLabel>
                        <RadioGroup
                          row
                          value={datetimeMode}
                          onChange={(e) => {
                            const newMode = e.target.value as 'individual' | 'range';
                            setDatetimeMode(newMode);
                            // Clear selections when switching modes
                            if (newMode === 'range') {
                              setSelectedDatetimes([]);
                            } else {
                              setStartDatetime('');
                              setEndDatetime('');
                            }
                            // Update URL
                            const isDataQuery = !!selectedDataQuery;
                            const locationFeature = selectedDataQuery.toLowerCase() === 'locations' ? selectedFeature : null;
                            setCollectionUrl(buildUrlWithParams(
                              collectionUrl, 
                              selectedFormat, 
                              selectedParameters, 
                              isDataQuery, 
                              clickedCoords, 
                              selectedArea, 
                              radiusKm, 
                              selectedDataQuery, 
                              locationFeature, 
                              [], 
                              newMode,
                              '',
                              ''
                            ));
                          }}
                          sx={{ gap: 2 }}
                        >
                          <FormControlLabel 
                            value="individual" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Individual Times</Typography>}
                          />
                          <FormControlLabel 
                            value="range" 
                            control={<Radio size="small" />} 
                            label={<Typography variant="body2">Time Range</Typography>}
                          />
                        </RadioGroup>
                      </FormControl>

                      {/* Individual Times Multi-Select */}
                      {datetimeMode === 'individual' && (
                        <FormControl fullWidth>
                          <InputLabel id="datetime-select-label">Select Times</InputLabel>
                          <Select
                            labelId="datetime-select-label"
                            multiple
                            value={selectedDatetimes}
                            label="Select Times"
                            onChange={(e) => {
                              const datetimes = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                              setSelectedDatetimes(datetimes);
                              // Update URL with datetime parameter
                              const isDataQuery = !!selectedDataQuery;
                              const locationFeature = selectedDataQuery.toLowerCase() === 'locations' ? selectedFeature : null;
                              setCollectionUrl(buildUrlWithParams(collectionUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, selectedArea, radiusKm, selectedDataQuery, locationFeature, datetimes, datetimeMode, startDatetime, endDatetime));
                            }}
                            size="small"
                            renderValue={(selected) => `${selected.length} time(s) selected`}
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
                                <Checkbox checked={selectedDatetimes.indexOf(datetime) > -1} />
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
                      )}

                      {/* Time Range Selectors */}
                      {datetimeMode === 'range' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel id="start-datetime-label">Start Time</InputLabel>
                            <Select
                              labelId="start-datetime-label"
                              value={startDatetime}
                              label="Start Time"
                              onChange={(e) => {
                                const newStart = e.target.value;
                                setStartDatetime(newStart);
                                // Update URL
                                const isDataQuery = !!selectedDataQuery;
                                const locationFeature = selectedDataQuery.toLowerCase() === 'locations' ? selectedFeature : null;
                                setCollectionUrl(buildUrlWithParams(collectionUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, selectedArea, radiusKm, selectedDataQuery, locationFeature, selectedDatetimes, datetimeMode, newStart, endDatetime));
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
                                // Update URL
                                const isDataQuery = !!selectedDataQuery;
                                const locationFeature = selectedDataQuery.toLowerCase() === 'locations' ? selectedFeature : null;
                                setCollectionUrl(buildUrlWithParams(collectionUrl, selectedFormat, selectedParameters, isDataQuery, clickedCoords, selectedArea, radiusKm, selectedDataQuery, locationFeature, selectedDatetimes, datetimeMode, startDatetime, newEnd));
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
                        </Box>
                      )}
                    </Box>
                  ) : null;
                })()}

                {/* GeoJSON Layers List with Toggle Buttons */}
                {activeGeoJsonLayers.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      GeoJSON Layers
                    </Typography>
                    {activeGeoJsonLayers.map((layer, idx) => (
                      <Box 
                        key={idx} 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          mb: 1,
                          p: 1,
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          borderRadius: 1,
                          backgroundColor: layer.visible ? 'rgba(33, 150, 243, 0.08)' : 'transparent'
                        }}
                      >
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {layer.title}
                        </Typography>
                        <Button
                          variant={layer.visible ? 'contained' : 'outlined'}
                          size="small"
                          color="primary"
                          onClick={() => {
                            const updatedLayers = activeGeoJsonLayers.map((l, i) => 
                              i === idx ? { ...l, visible: !l.visible } : l
                            );
                            setActiveGeoJsonLayers(updatedLayers);
                            if (onGeoJsonLayersChange) {
                              onGeoJsonLayersChange(updatedLayers);
                            }
                          }}
                          sx={{ ml: 1 }}
                        >
                          {layer.visible ? 'Hide' : 'Show'}
                        </Button>
                      </Box>
                    ))}
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