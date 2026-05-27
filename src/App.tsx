import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import { CustomService } from './types/CustomService';
import React, { lazy, Suspense, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Lazy-loaded components (not needed for first paint)
const OpenLayersMap = lazy(() => import('./Map'));
const SettingsDrawer = lazy(() => import('./SettingsDrawer'));
const DataModal = lazy(() => import('./DataModal'));
import ErrorBoundary from './ErrorBoundary';
import { GeoJsonLayerProvider, useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { MapsLayerProvider } from './contexts/MapsLayerContext';
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
            <MapsLayerProvider>
              <LayerManagerProvider>
                <ValidationProvider>
                  <AppContent
                    customServices={customServices}
                    setCustomServices={setCustomServices}
                  />
                </ValidationProvider>
              </LayerManagerProvider>
            </MapsLayerProvider>
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
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const { setGeoJsonLayers } = useGeoJsonLayers();
  const { collectionUrl } = useCollection();
  useCollectionKeyboardNav();
  const { getAuthCredentials, setSelectedServiceUrl } = useService();

  // Abort controller for in-flight data fetches
  const fetchControllerRef = useRef<AbortController | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<string | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const modalImageUrlRef = useRef<string | null>(null);
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
        case '?':
          setShortcutsHelpOpen(prev => !prev);
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

    // Cancel any in-flight fetch
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    setModalOpen(true);
    setModalUrl(collectionUrl);
    setModalValidationErrors([]);
    setModalValidationSchemaName(null);
    setModalScrollToPath(undefined);
    setModalLoading(true);
    setModalError(null);
    setModalData(null);
    setModalContentType(null);
    // Release any image blob URL from a previous fetch before starting a new one.
    if (modalImageUrlRef.current) {
      URL.revokeObjectURL(modalImageUrlRef.current);
      modalImageUrlRef.current = null;
    }
    setModalImageUrl(null);

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
        // Use arraybuffer so binary responses (image/png from OGC API Maps, etc.) survive intact;
        // we decode to text manually for non-binary content types below.
        responseType: 'arraybuffer',
        signal: controller.signal,
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

      // Binary image response (image/png, image/jpeg, image/webp, image/svg+xml, etc.):
      // wrap the arraybuffer in a blob URL so the modal can render it via <img>.
      if (contentType.startsWith('image/')) {
        const blob = new Blob([response.data], { type: contentType });
        const objectUrl = URL.createObjectURL(blob);
        modalImageUrlRef.current = objectUrl;
        setModalImageUrl(objectUrl);
        return;
      }

      // Text-ish response: decode the arraybuffer and continue with the existing pipeline.
      const decoded = new TextDecoder('utf-8').decode(response.data as ArrayBuffer);
      const responseData = decoded;
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
          const geoJsonData = JSON.parse(responseData);
          
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
      // Ignore aborted requests (user started a new fetch or closed modal)
      if (controller.signal.aborted) return;

      console.error('Error fetching data:', error);

      // Classify error for actionable feedback
      let message = error.message || 'Failed to fetch data';

      if (error.response?.status === 401 || error.response?.status === 403) {
        message = `Authentication failed (${error.response.status}). Check your credentials in Settings (S).`;
      } else if (error.response?.status === 404) {
        message = `Endpoint not found (404). Verify the query URL is correct.`;
      } else if (error.response?.status === 429) {
        message = `Rate limited (429). Wait a moment and try again.`;
      } else if (error.response?.status >= 500) {
        message = `Server error (${error.response.status}). The API returned an internal error.`;
      } else if (
        error.message?.includes('CORS') ||
        error.message?.includes('Access-Control-Allow-Origin') ||
        error.message?.includes('cross-origin')
      ) {
        message = 'CORS blocked. Your API must include the Access-Control-Allow-Origin header for this origin.';
      } else if (
        error.code === 'ERR_NETWORK' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('Failed to fetch')
      ) {
        message = 'Network error. The API may be unreachable or blocking cross-origin requests (CORS).';
      }

      setModalError(message);
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
    if (modalImageUrlRef.current) {
      URL.revokeObjectURL(modalImageUrlRef.current);
      modalImageUrlRef.current = null;
    }
    setModalImageUrl(null);
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
        <ErrorBoundary fallbackMessage="Sidebar crashed. Click Retry to recover.">
          <Sidebar
            open={sidebarOpen}
          />
        </ErrorBoundary>
        
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <ErrorBoundary fallbackMessage="Map crashed. Click Retry to recover.">
            <Suspense fallback={<Box sx={{ width: '100%', height: '100%', bgcolor: 'background.default' }} />}>
              <OpenLayersMap
                zoomLevel={2}
              />
            </Suspense>
          </ErrorBoundary>
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

      <KeyboardShortcutsHelp open={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />

      <ErrorBoundary fallbackMessage="Data viewer crashed. Click Retry to recover.">
        <Suspense fallback={null}>
          <DataModal
            open={modalOpen}
            onClose={handleCloseModal}
            data={modalData}
            imageUrl={modalImageUrl}
            contentType={modalContentType}
            isLoading={modalLoading}
            error={modalError}
            url={modalUrl || collectionUrl}
            validationErrors={modalValidationErrors}
            validationSchemaName={modalValidationSchemaName}
            scrollToPath={modalScrollToPath}
          />
        </Suspense>
      </ErrorBoundary>
    </Box>
    </ThemeProvider>
  );
}

export default App;
