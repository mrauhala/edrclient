import Sidebar from './Sidebar';
import TopMenu from './TopMenu';
import { CustomService } from './types/CustomService';
import React, { lazy, Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Lazy-loaded components (not needed for first paint)
const OpenLayersMap = lazy(() => import('./Map'));
const SettingsDrawer = lazy(() => import('./SettingsDrawer'));
const ResponsePane = lazy(() => import('./ResponsePane'));
import ErrorBoundary from './ErrorBoundary';
import { GeoJsonLayerProvider } from './contexts/GeoJsonLayerContext';
import { MapsLayerProvider } from './contexts/MapsLayerContext';
import { ResponseCellsProvider } from './contexts/ResponseCellsContext';
import { LayerManagerProvider } from './contexts/LayerManagerContext';
import { ValidationProvider } from './contexts/ValidationContext';
import { OpenApiProvider } from './contexts/OpenApiContext';
import { MapInteractionProvider } from './contexts/MapInteractionContext';
import { CollectionProvider, useCollection } from './contexts/CollectionContext';
import { QueryValidationProvider } from './contexts/QueryValidationContext';
import { useCollectionKeyboardNav } from './hooks/useCollectionKeyboardNav';
import { useQueryResponse } from './hooks/useQueryResponse';
import { ServiceProvider, useService } from './contexts/ServiceContext';
import { PanesProvider, usePanesState } from './contexts/PanesContext';
import PaneToggles from './PaneToggles';
import ResponseDock from './ResponseDock';
import ResponseStatusButton from './ResponseStatusButton';
import { ALL_PANES_WIDTH, MIN_MAP_WIDTH, leftPaneOpen } from './panes';
import SendButton from './SendButton';
import RequestUrlField from './RequestUrlField';
import { RequestUrlProvider, useRequestUrl } from './contexts/RequestUrlContext';
import { QueryBuilderProvider } from './contexts/QueryBuilderContext';
import { ApiProvider, useApi } from './contexts/ApiContext';
import { OpenCollectionProvider, useOpenCollection } from './contexts/OpenCollectionContext';
import { OpenRequestProvider, useOpenRequest } from './contexts/OpenRequestContext';
import RequestNotice from './RequestNotice';
import { useRequestIssues } from './hooks/useRequestIssues';
import { isSendableUrl } from './query/requestUrl';
import { requestLink } from './query/requestLink';
import CopyMenu from './CopyMenu';
import Paper from '@mui/material/Paper';
import useMediaQuery from '@mui/material/useMediaQuery';


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

  // Save custom services to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('customServices', JSON.stringify(customServices));
  }, [customServices]);

  return (
    <ServiceProvider customServices={customServices}>
      <CollectionProvider>
        <RequestUrlProvider>
        <QueryValidationProvider>
          <MapInteractionProvider>
            <GeoJsonLayerProvider>
              <MapsLayerProvider>
                <ResponseCellsProvider>
                <LayerManagerProvider>
                  <ValidationProvider>
                    <OpenApiProvider>
                      <QueryBuilderProvider>
                        <ApiProvider>
                          <OpenCollectionProvider>
                            <OpenRequestProvider>
                              <AppContent
                                customServices={customServices}
                                setCustomServices={setCustomServices}
                              />
                            </OpenRequestProvider>
                          </OpenCollectionProvider>
                        </ApiProvider>
                      </QueryBuilderProvider>
                    </OpenApiProvider>
                  </ValidationProvider>
                </LayerManagerProvider>
                </ResponseCellsProvider>
              </MapsLayerProvider>
            </GeoJsonLayerProvider>
          </MapInteractionProvider>
        </QueryValidationProvider>
        </RequestUrlProvider>
      </CollectionProvider>
    </ServiceProvider>
  );
}

interface AppContentProps {
  customServices: CustomService[];
  setCustomServices: React.Dispatch<React.SetStateAction<CustomService[]>>;
}

function AppContent({ customServices, setCustomServices }: AppContentProps) {
  // Load theme mode from localStorage or default to 'dark'
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')
      ? savedMode
      : 'dark';
  });

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const { requestUrl, isEdited } = useRequestUrl();
  const { openRequest, note: requestNote, clearNote } = useOpenRequest();
  const { issues: requestIssues, summary: requestSummary } = useRequestIssues();
  const { getAuthCredentials } = useService();
  const { selectedCollection } = useCollection();
  const { openSerial } = useOpenCollection();
  const { loadApi } = useApi();

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

  // Create theme based on actual mode
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: actualMode,
        },
        components: {
          // Drawers and full-screen dialogs touch the screen's edges: keep their content clear of
          // notches, the home indicator and gesture bars (the --safe-* variables in index.css)
          MuiDrawer: {
            styleOverrides: {
              paper: ({ ownerState }) => ({
                paddingTop: ownerState.anchor === 'bottom' ? undefined : 'var(--safe-top)',
                paddingRight: ownerState.anchor === 'left' ? undefined : 'var(--safe-right)',
                paddingBottom: ownerState.anchor === 'top' ? undefined : 'var(--safe-bottom)',
                paddingLeft: ownerState.anchor === 'right' ? undefined : 'var(--safe-left)',
              }),
            },
          },
          MuiDialog: {
            styleOverrides: {
              paperFullScreen: {
                padding: 'var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)',
              },
            },
          },
        },
      }),
    [actualMode]
  );

  // Phones show one pane at a time, with the others covering the map
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const allPanesFit = useMediaQuery(`(min-width:${ALL_PANES_WIDTH}px)`, { noSsr: true });
  const panes = usePanesState(isMobile, allPanesFit, !!selectedCollection, openSerial);
  const { isOpen, togglePane, showPane } = panes;
  useCollectionKeyboardNav(isOpen.api);
  const showResponse = useCallback(() => showPane('response'), [showPane]);
  const { fetchQuery, pane: responsePane } = useQueryResponse(showResponse);
  const mapHidden = !isMobile && !isOpen.map;
  // A phone on its side has no height to spare for another row: the URL stays in the bottom bar
  const shortWindow = useMediaQuery('(max-height:499.95px)', { noSsr: true });
  const urlInTopRow = !isMobile || !shortWindow;
  const narrowWindow = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  const handleSettingsDrawerToggle = useCallback(() => {
    setSettingsDrawerOpen(prev => !prev);
  }, []);

  // Single-letter keyboard shortcuts: A=API, B=request, M=map, R=response, S=settings, L=layers, V=validation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'a':
          togglePane('api');
          break;
        case 'b':
          togglePane('request');
          break;
        case 'm':
          togglePane('map');
          break;
        case 'r':
          togglePane('response');
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
  }, [togglePane, handleSettingsDrawerToggle]);

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

  const handleSend = useCallback(() => {
    if (!isSendableUrl(requestUrl)) return;
    // What's sent is what's shown, so the app goes where an edited URL points
    if (isEdited) openRequest(requestUrl, { switchApi: true });
    fetchQuery(requestUrl);
    // Reloading brings the request back, and the address can be passed on
    window.history.replaceState(null, '', requestLink(requestUrl, window.location.href));
  }, [requestUrl, isEdited, openRequest, fetchQuery]);

  // Cmd+Enter (Mac) / Ctrl+Enter (Windows) to send the request
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleSend();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleSend]);

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

  // Leaving the field goes no further than this API: another one would replace all that's in the form
  const followUrl = (url: string) => openRequest(url, { switchApi: false });
  const copyButton = (
    <CopyMenu
      url={requestUrl}
      auth={requestUrl ? getAuthCredentials(requestUrl) : undefined}
      compact={narrowWindow || !urlInTopRow}
      atBottom={!urlInTopRow}
    />
  );
  const sendButton = (
    <SendButton issues={requestIssues} summary={requestSummary} disabled={!isSendableUrl(requestUrl)} onSend={handleSend} />
  );

  return (
    <ThemeProvider theme={theme}>
    <PanesProvider value={panes}>
      <CssBaseline />
      {/* The visible viewport (dvh), not the one with the browser's toolbars hidden (vh), which is taller on phones */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', '@supports (height: 100dvh)': { height: '100dvh' }, overflow: 'hidden' }}>
        <TopMenu onSettingsClick={handleSettingsDrawerToggle} />

        {/* The request as it will be sent. Above the panes, since the field opens over them while editing */}
        {urlInTopRow && (
          <Paper
            elevation={2}
            sx={{
              flexShrink: 0,
              position: 'relative',
              zIndex: 1200,
              borderRadius: 0,
              pl: 'var(--safe-left)',
              pr: 'var(--safe-right)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: isMobile ? 0.5 : 0.75 }}>
              <RequestUrlField onSend={handleSend} onCommit={followUrl} compact={narrowWindow} />
              {!isMobile && sendButton}
              {copyButton}
              {!isMobile && !isOpen.response && (
                <ResponseStatusButton
                  response={responsePane.response}
                  isLoading={responsePane.isLoading}
                  hasError={responsePane.error !== null}
                  onClick={showResponse}
                />
              )}
            </Box>
          </Paper>
        )}

      {/* Positioned, so that on phones the panes on top of the map cover just this row, between the bars */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <ErrorBoundary fallbackMessage="Sidebar crashed. Click Retry to recover.">
          <Sidebar />
        </ErrorBoundary>

        {/* Clear of a notch on the sides in landscape, unless a pane is between. Hidden, it stays loaded and
            at the row's size, since OpenLayers can't frame anything for a map with no size */}
        <Box
          component="main"
          sx={{
            height: '100%',
            overflow: 'hidden',
            pl: leftPaneOpen(isOpen) && !isMobile ? 0 : 'var(--safe-left)',
            pr: isOpen.response && !isMobile ? 0 : 'var(--safe-right)',
            ...(mapHidden
              ? { position: 'absolute', inset: 0, visibility: 'hidden' }
              : { position: 'relative', flex: '1 1 0', minWidth: isMobile ? 0 : MIN_MAP_WIDTH }),
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

        <ResponseDock>
          <ErrorBoundary fallbackMessage="Response pane crashed. Click Retry to recover.">
            <Suspense fallback={null}>
              <ResponsePane open={isOpen.response} onClose={() => togglePane('response')} {...responsePane} />
            </Suspense>
          </ErrorBoundary>
        </ResponseDock>
      </Box>

      {/* On phones: the panes and Send, within reach of a thumb. Above the panes that cover the map, and clear of the home indicator */}
      {isMobile && (
        <Paper
          elevation={8}
          sx={{
            flexShrink: 0,
            position: 'relative',
            zIndex: 1200,
            borderRadius: 0,
            borderTop: '1px solid rgba(0, 0, 0, 0.12)',
            pb: 'var(--safe-bottom)',
            pl: 'var(--safe-left)',
            pr: 'var(--safe-right)',
          }}
        >
          {/* 56px with the border */}
          <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 1, height: 55 }}>
            <PaneToggles sx={{ '& .MuiToggleButton-root': { width: 40, height: 40 } }} />
            {!urlInTopRow && <RequestUrlField onSend={handleSend} onCommit={followUrl} expandUp compact />}
            {!urlInTopRow && copyButton}
            <Box sx={{ ml: 'auto', flexShrink: 0 }}>{sendButton}</Box>
          </Box>
        </Paper>
      )}

      <RequestNotice message={requestNote} severity="info" onClose={clearNote} horizontal="center" atBottom={!urlInTopRow} />

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
          onServiceSelect={loadApi}
        />
      </Suspense>

      <KeyboardShortcutsHelp open={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />

    </Box>
    </PanesProvider>
    </ThemeProvider>
  );
}

export default App;
