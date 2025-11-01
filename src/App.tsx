import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import SettingsDrawer, { CustomService } from './SettingsDrawer';
import { useState, useMemo, useEffect } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import OpenLayersMap from './Map';
import { Collection } from './DataRetrievalAPI';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';


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
  const [clickedCoords, setClickedCoords] = useState<[number, number] | null>(null);
  const [dataQuery, setDataQuery] = useState<string>('');

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

  const handleUpdateBoundingBox = (newBoundingBox: [number, number, number, number]) => {
    setBoundingBox(newBoundingBox);
  };

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

  const handleCopyUrl = () => {
    if (collectionUrl) {
      navigator.clipboard.writeText(collectionUrl);
    }
  };

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
          locationFeatures={locationFeatures}
          onCollectionUrlChange={setCollectionUrl}
          customServices={customServices}
          onServiceUrlSelect={selectedServiceUrl}
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
            dataQuery={dataQuery} 
            onMapClick={setClickedCoords} 
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
    </Box>
    </ThemeProvider>
  );
}

export default App;
