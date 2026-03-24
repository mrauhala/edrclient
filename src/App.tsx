import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import { CustomService } from './types/CustomService';
import React, { lazy, Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Lazy-loaded components (not needed for first paint)
const OpenLayersMap = lazy(() => import('./Map'));
const SettingsDrawer = lazy(() => import('./SettingsDrawer'));
const DataModal = lazy(() => import('./DataModal'));
import { GeoJsonLayerProvider, useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { LayerManagerProvider } from './contexts/LayerManagerContext';
import { ValidationProvider } from './contexts/ValidationContext';
import { MapInteractionProvider } from './contexts/MapInteractionContext';
import { CollectionProvider, useCollection } from './contexts/CollectionContext';
import { useCollectionKeyboardNav } from './hooks/useCollectionKeyboardNav';
import { ServiceProvider, useService } from './contexts/ServiceContext';
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
import { QueryResultValidator } from './QueryResultValidator';


function App() {
  // Load custom services from localStorage
  const [customServices, setCustomServices] = useState<CustomService[]>(() => {
    const savedServices = localStorage.getItem('customServices');
    try {
      return savedServices ? JSON.parse(savedServices) : [];
    } catch {
      return [];
    }
  });

  const [selectedServiceUrl, setSelectedServiceUrl] = useState<string | null>(null);

  // Save custom services to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('customServices', JSON.stringify(customServices));
  }, [customServices]);

  return (
    <ServiceProvider customServices={customServices} selectedServiceUrl={selectedServiceUrl} setSelectedServiceUrl={setSelectedServiceUrl}>
      <CollectionProvider>
        <MapInteractionProvider>
          <GeoJsonLayerProvider>
            <LayerManagerProvider>
              <ValidationProvider>
                <AppContent
                  customServices={customServices}
                  setCustomServices={setCustomServices}
                />
              </ValidationProvider>
            </LayerManagerProvider>
          </GeoJsonLayerProvider>
        </MapInteractionProvider>
      </CollectionProvider>
    </ServiceProvider>
  );
}

interface AppContentProps {
  customServices: CustomService[];
  setCustomServices: React.Dispatch<React.SetStateAction<CustomService[]>>;
}

function AppContent({ customServices, setCustomServices }: AppContentProps) {
  // Load theme mode from localStorage or default to 'system'
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')
      ? savedMode
      : 'system';
  });

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { setGeoJsonLayers } = useGeoJsonLayers();
  const { collectionUrl } = useCollection();
  useCollectionKeyboardNav();
  const { getAuthCredentials, setSelectedServiceUrl } = useService();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<string | null>(null);
  const [modalContentType, setModalContentType] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState<string>('');
  const [modalValidationErrors, setModalValidationErrors] = useState<import('./types/api').ValidationError[]>([]);
  const [modalValidationSchemaName, setModalValidationSchemaName] = useState<string | null>(null);
  const [modalScrollToPath, setModalScrollToPath] = useState<string | undefined>();

  // Detect system preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Save theme mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Determine actual mode based on themeMode setting
  const actualMode = useMemo(() => {
    if (themeMode === 'system') {
      return prefersDarkMode ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, prefersDarkMode]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const handleSettingsDrawerToggle = useCallback(() => {
    setSettingsDrawerOpen(prev => !prev);
  }, []);

  // Single-letter keyboard shortcuts: B=sidebar, S=settings, L=layers, V=validation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'b':
          handleSidebarToggle();
          break;
        case 's':
          handleSettingsDrawerToggle();
          break;
        case 'l':
          document.dispatchEvent(new Event('close-validation-popover'));
          document.dispatchEvent(new Event('toggle-layers-popover'));
          break;
        case 'v':
          document.dispatchEvent(new Event('close-layers-popover'));
          document.dispatchEvent(new Event('toggle-validation-popover'));
          break;
        case 'i':
          document.dispatchEvent(new Event('toggle-collection-info'));
          break;
        case '/':
          document.dispatchEvent(new Event('close-validation-popover'));
          document.dispatchEvent(new Event('close-layers-popover'));
          document.dispatchEvent(new Event('toggle-search-popover'));
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSidebarToggle, handleSettingsDrawerToggle]);

  // Listen for validation error clicks to open API response viewer with stored data
  const handleOpenValidationResponse = useCallback((e: Event) => {
    const { url, errors, scrollToPath, data: responseData } = (e as CustomEvent).detail;
    if (!url || !responseData) return;

    setModalOpen(true);
    setModalLoading(false);
    setModalError(null);
    setModalData(responseData);
    setModalContentType('application/json');
    setModalUrl(url);
    setModalValidationErrors(errors || []);
    setModalScrollToPath(scrollToPath);
  }, []);

  useEffect(() => {
    document.addEventListener('open-validation-response', handleOpenValidationResponse);
    return () => document.removeEventListener('open-validation-response', handleOpenValidationResponse);
  }, [handleOpenValidationResponse]);

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


  const handleCopyUrl = () => {
    if (collectionUrl) {
      navigator.clipboard.writeText(collectionUrl);
    }
  };

  const handleFetchData = useCallback(async () => {
    if (!collectionUrl) return;

    setModalOpen(true);
    setModalUrl(collectionUrl);
    setModalValidationErrors([]);
    setModalValidationSchemaName(null);
    setModalScrollToPath(undefined);
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

      // Validate query result against registered schemas (e.g. CoverageJSON)
      try {
        const validation = await QueryResultValidator.getInstance().validate(responseData, contentType, collectionUrl);
        if (validation.matched) {
          setModalValidationSchemaName(validation.schemaName || null);
          setModalValidationErrors(validation.errors || []);
        }
      } catch (e) {
        console.error('Query result validation failed:', e);
      }

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
  }, [collectionUrl, getAuthCredentials, setGeoJsonLayers]);

  // Cmd+Enter (Mac) / Ctrl+Enter (Windows) to fetch data
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleFetchData();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleFetchData]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalValidationErrors([]);
    setModalValidationSchemaName(null);
    setModalScrollToPath(undefined);
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
          <Suspense fallback={<Box sx={{ width: '100%', height: '100%', bgcolor: 'background.default' }} />}>
            <OpenLayersMap
              zoomLevel={2}
            />
          </Suspense>
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
      
      <Suspense fallback={null}>
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
      </Suspense>

      <Suspense fallback={null}>
        <DataModal
          open={modalOpen}
          onClose={handleCloseModal}
          data={modalData}
          contentType={modalContentType}
          isLoading={modalLoading}
          error={modalError}
          url={modalUrl || collectionUrl}
          validationErrors={modalValidationErrors}
          validationSchemaName={modalValidationSchemaName}
          scrollToPath={modalScrollToPath}
        />
      </Suspense>
    </Box>
    </ThemeProvider>
  );
}

export default App;
