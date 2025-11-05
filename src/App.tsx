import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import SettingsDrawer, { CustomService } from './SettingsDrawer';
import DataModal from './DataModal';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import OpenLayersMap from './Map';
import { Collection } from './DataRetrievalAPI';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import axios from 'axios';


function App() {
  // Load theme mode from localStorage or default to 'system'
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') 
      ? savedMode 
      : 'system';
  });

  // Load custom services from localStorage
  const [customServices, setCustomServices] = useState<CustomService[]>(() => {
    const savedServices = localStorage.getItem('customServices');
    try {
      return savedServices ? JSON.parse(savedServices) : [];
    } catch {
      return [];
    }
  });

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collectionUrl, setCollectionUrl] = useState<string>('');
  const [selectedServiceUrl, setSelectedServiceUrl] = useState<string | null>(null);

  const [boundingBox, setBoundingBox] = useState<[number, number, number, number]>([-180, -90, 180, 90]);
  const [selectedCollectionExtents, setSelectedCollectionExtents] = useState<[number, number, number, number][] | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [locationFeatures, setLocationFeatures] = useState<any[] | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [clickedCoords, setClickedCoords] = useState<[number, number][]>([]);
  const [selectedArea, setSelectedArea] = useState<[number, number][][]>([]);
  const [radiusKm, setRadiusKm] = useState<number>(10); // Default 10km radius
  const [dataQuery, setDataQuery] = useState<string>('');
  const [geoJsonLayers, setGeoJsonLayers] = useState<{url: string, title: string, visible: boolean, labelProperty?: string, apiKey?: string, apiKeyParam?: string}[]>([]);
  const [selectedGeoJsonFeature, setSelectedGeoJsonFeature] = useState<any | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<string | null>(null);
  const [modalContentType, setModalContentType] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Detect system preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Save theme mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Save custom services to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('customServices', JSON.stringify(customServices));
  }, [customServices]);

  // Determine actual mode based on themeMode setting
  const actualMode = useMemo(() => {
    if (themeMode === 'system') {
      return prefersDarkMode ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, prefersDarkMode]);

  const handleUpdateBoundingBox = useCallback((newBoundingBox: [number, number, number, number]) => {
    setBoundingBox(newBoundingBox);
  }, []);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSettingsDrawerToggle = () => {
    setSettingsDrawerOpen(!settingsDrawerOpen);
  };

  const handleThemeModeChange = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
  };

  const handleAddService = (service: CustomService) => {
    setCustomServices((prev) => [...prev, service]);
  };

  const handleUpdateService = (service: CustomService) => {
    setCustomServices((prev) => 
      prev.map((s) => (s.id === service.id ? service : s))
    );
  };

  const handleRemoveService = (id: string) => {
    setCustomServices((prev) => prev.filter((service) => service.id !== id));
  };

  const handleServiceSelect = (url: string) => {
    setSelectedServiceUrl(url);
    // Reset after a short delay so it can be triggered again if needed
    setTimeout(() => setSelectedServiceUrl(null), 100);
  };

  // Create theme based on actual mode
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: actualMode,
        },
      }),
    [actualMode]
  );

  const handleFeatureSelect = (feature: any | null) => {
    setSelectedFeature(feature);
    
    // If a feature is selected and it has coordinates, update the bounding box to zoom to it
    if (feature && feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates;
      if (feature.geometry.type === 'Point') {
        const [lon, lat] = coords;
        // Create a small bounding box around the point for zooming
        const margin = 0.01; // Small margin around the point
        setBoundingBox([lon - margin, lat - margin, lon + margin, lat + margin]);
      }
    }
  };

  // Helper function to get auth credentials for a given URL
  const getAuthCredentials = (url: string) => {
    const service = customServices.find(s => url.includes(s.url));
    if (service) {
      if (service.bearerToken) {
        return {
          bearerToken: service.bearerToken
        };
      } else if (service.apiKey) {
        return {
          apiKey: service.apiKey,
          apiKeyParam: service.apiKeyParam
        };
      } else if (service.username) {
        return {
          username: service.username,
          password: service.password || ''
        };
      }
    }
    return undefined;
  };

  const handleCopyUrl = () => {
    if (collectionUrl) {
      navigator.clipboard.writeText(collectionUrl);
    }
  };

  const handleFetchData = async () => {
    if (!collectionUrl) return;
    
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setModalData(null);
    setModalContentType(null);

    try {
      const auth = getAuthCredentials(collectionUrl);
      
      // Add API key to URL if provided
      let finalUrl = collectionUrl;
      if (auth && (auth as any).apiKey) {
        const urlObj = new URL(collectionUrl);
        const paramName = (auth as any).apiKeyParam || 'api-key';
        urlObj.searchParams.set(paramName, (auth as any).apiKey);
        finalUrl = urlObj.toString();
      }
      
      const config: any = {
        responseType: 'text',
        headers: {
          'Accept': '*/*'
        }
      };
      
      // Add Bearer token if provided
      if (auth && (auth as any).bearerToken) {
        config.headers['Authorization'] = `Bearer ${(auth as any).bearerToken}`;
      }
      // Add basic auth if credentials are available
      else if (auth && (auth as any).username) {
        config.auth = {
          username: (auth as any).username,
          password: (auth as any).password
        };
      }
      
      const response = await axios.get(finalUrl, config);

      const contentType = response.headers['content-type'] || '';
      setModalContentType(contentType);
      
      // Convert response to string if needed
      const responseData = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data, null, 2);
      
      setModalData(responseData);

      // If it's GeoJSON, add it as a layer
      // Check for various GeoJSON format indicators (case-insensitive)
      const isGeoJson = contentType.includes('json') && (
        collectionUrl.toLowerCase().includes('f=geojson') ||
        collectionUrl.toLowerCase().includes('f=application/geo%2bjson') ||
        collectionUrl.toLowerCase().includes('f=application/geo+json')
      );
      
      if (isGeoJson) {
        try {
          const geoJsonData = typeof response.data === 'string' 
            ? JSON.parse(response.data) 
            : response.data;
          
          if (geoJsonData.type === 'FeatureCollection' || geoJsonData.type === 'Feature') {
            // Generate a title from the URL or use a default
            const urlParts = collectionUrl.split('/');
            const collectionName = urlParts.find(part => part.includes('collections'))
              ? urlParts[urlParts.indexOf(urlParts.find(part => part.includes('collections'))!) + 1]
              : 'Fetched Data';
            
            const newLayer = {
              url: collectionUrl,
              title: `${collectionName} (Fetched)`,
              visible: true,
              labelProperty: 'name',
              data: geoJsonData  // Pass the pre-fetched data
            };

            // Add layer if it doesn't already exist
            setGeoJsonLayers(prev => {
              const exists = prev.some(layer => layer.url === collectionUrl);
              if (exists) {
                return prev;
              }
              return [...prev, newLayer];
            });
          }
        } catch (e) {
          console.error('Error parsing GeoJSON:', e);
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setModalError(error.message || 'Failed to fetch data');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  // Update document data-theme attribute when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', actualMode);
  }, [actualMode]);

  // Detect Safari and add data attribute for conditional styling
  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      document.documentElement.setAttribute('data-browser', 'safari');
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopMenu onMenuClick={handleSidebarToggle} onSettingsClick={handleSettingsDrawerToggle} />
      
      <Box 
        sx={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden',
          paddingBottom: '56px', // Height of the bottom bar
        }}
      >
        <Sidebar 
          open={sidebarOpen} 
          onClose={handleSidebarToggle} 
          boundingBox={boundingBox} 
          setBoundingBox={setBoundingBox} 
          onCollectionExtentChange={setSelectedCollectionExtents} 
          onLocationFeaturesChange={setLocationFeatures} 
          onFeatureSelect={handleFeatureSelect} 
          onSelectedCollectionChange={setSelectedCollection} 
          onMapClick={setClickedCoords} 
          onDataQueryChange={setDataQuery} 
          clickedCoords={clickedCoords} 
          selectedArea={selectedArea}
          radiusKm={radiusKm}
          locationFeatures={locationFeatures}
          selectedFeature={selectedFeature}
          onCollectionUrlChange={setCollectionUrl}
          customServices={customServices}
          onServiceUrlSelect={selectedServiceUrl}
          onGeoJsonLayersChange={setGeoJsonLayers}
          getAuthCredentials={getAuthCredentials}
        />
        
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <OpenLayersMap 
            zoomLevel={2} 
            boundingBox={boundingBox} 
            selectedCollectionExtents={selectedCollectionExtents} 
            selectedCollection={selectedCollection} 
            locationFeatures={locationFeatures} 
            selectedFeature={selectedFeature} 
            onUpdateBoundingBox={handleUpdateBoundingBox} 
            onFeatureSelect={handleFeatureSelect} 
            clickedCoords={clickedCoords} 
            selectedArea={selectedArea}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            dataQuery={dataQuery} 
            onMapClick={setClickedCoords}
            onAreaSelect={setSelectedArea}
            geoJsonLayers={geoJsonLayers}
            selectedGeoJsonFeature={selectedGeoJsonFeature}
            onGeoJsonFeatureSelect={setSelectedGeoJsonFeature}
            onGeoJsonLayerUpdate={setGeoJsonLayers}
          />
        </Box>
      </Box>
      
      {/* Fixed Bottom Query Bar - Always Visible */}
      <Paper 
        elevation={8}
        sx={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          borderRadius: 0,
          borderTop: '1px solid rgba(0, 0, 0, 0.12)',
          height: '56px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 1, height: '100%' }}>
          {collectionUrl ? (
            <>
              <TextField
                fullWidth
                size="small"
                value={collectionUrl}
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                }}
                variant="outlined"
              />
              <Tooltip title="Copy URL">
                <IconButton 
                  color="primary" 
                  onClick={handleCopyUrl}
                  sx={{ flexShrink: 0 }}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fetch Data">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleFetchData}
                  startIcon={<CloudDownloadIcon />}
                  sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Fetch
                </Button>
              </Tooltip>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              Select a collection and query to generate URL
            </Typography>
          )}
        </Box>
      </Paper>
      
      <SettingsDrawer 
        open={settingsDrawerOpen}
        onClose={handleSettingsDrawerToggle}
        themeMode={themeMode}
        onThemeModeChange={handleThemeModeChange}
        customServices={customServices}
        onAddService={handleAddService}
        onUpdateService={handleUpdateService}
        onRemoveService={handleRemoveService}
        onServiceSelect={handleServiceSelect}
      />

      <DataModal
        open={modalOpen}
        onClose={handleCloseModal}
        data={modalData}
        contentType={modalContentType}
        isLoading={modalLoading}
        error={modalError}
        url={collectionUrl}
      />
    </Box>
    </ThemeProvider>
  );
}

export default App;
