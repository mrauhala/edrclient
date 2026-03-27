import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Popper from '@mui/material/Popper';
import Paper from '@mui/material/Paper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Dialog from '@mui/material/Dialog';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCollection } from './contexts/CollectionContext';
import { useService } from './contexts/ServiceContext';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import systemServices from './config/services.json';
import { ServiceDefinition } from './types/ServiceType';
import { SERVICE_TYPE_ORDER } from './config/serviceTypeConfig';
import type { ActiveTab, FilterField, ServiceItem, CollectionResult, LocationResult, FeatureItem } from './search/types';
import { DEFAULT_FILTERS } from './search/types';
import { matchService, matchCollection, matchLocation, formatCoordinates } from './search/matching';
import { hasLocationQuery } from './api/queries';
import { SearchContent } from './search/SearchContent';
import { useItemsFetch } from './search/hooks/useItemsFetch';
import { useSearchNavigation } from './search/hooks/useSearchNavigation';

const typedSystemServices: ServiceDefinition[] = systemServices as ServiceDefinition[];

const CommandPalette: React.FC = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { collections, selectedCollection, selectCollectionByIndexRef, locationFeatures, setSelectedFeature } = useCollection();
  const { activeServiceUrl, customServices, setSelectedServiceUrl } = useService();
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('collections');
  const [filters, setFilters] = useState<Set<FilterField>>(new Set(DEFAULT_FILTERS));
  const [showFilters, setShowFilters] = useState(false);

  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Items fetching and pagination
  const {
    filteredItems,
    itemsLoading,
    itemsError,
    itemsEnabled,
    isRecordCollection,
    itemsOffset,
    itemsTotal,
    itemsPageSize,
    itemsPageCount,
    handleItemsNextPage,
    handleItemsPrevPage,
  } = useItemsFetch({ query, activeTab, setActiveTab });

  // Build combined service list
  const allServices: ServiceItem[] = useMemo(() => {
    const items: ServiceItem[] = typedSystemServices.map(s => ({
      label: s.label,
      url: s.url,
      type: s.type,
      isActive: s.url === activeServiceUrl,
    }));
    for (const cs of customServices) {
      items.push({
        label: cs.name,
        url: cs.url,
        type: cs.type,
        isActive: cs.url === activeServiceUrl,
      });
    }
    items.sort((a, b) => {
      const ai = a.type ? SERVICE_TYPE_ORDER.indexOf(a.type) : SERVICE_TYPE_ORDER.length;
      const bi = b.type ? SERVICE_TYPE_ORDER.indexOf(b.type) : SERVICE_TYPE_ORDER.length;
      if (ai !== bi) return ai - bi;
      return a.label.localeCompare(b.label);
    });
    return items;
  }, [activeServiceUrl, customServices]);

  // Filter services
  const filteredServices = useMemo(() => {
    if (!query) return allServices;
    return allServices.filter(s => matchService(s, query));
  }, [allServices, query]);

  // Filter collections
  const filteredCollections = useMemo(() => {
    if (!query) {
      return collections.map((c, i) => ({ collection: c, originalIndex: i, matchedKeywords: [] as string[] }));
    }
    const results: CollectionResult[] = [];
    for (let i = 0; i < collections.length; i++) {
      const { matches, matchedKeywords } = matchCollection(collections[i], query, filters);
      if (matches) {
        results.push({ collection: collections[i], originalIndex: i, matchedKeywords });
      }
    }
    return results;
  }, [collections, query, filters]);

  // Locations
  const locationsEnabled = !!selectedCollection && hasLocationQuery(selectedCollection);

  const allLocations: LocationResult[] = useMemo(() => {
    if (!locationFeatures) return [];
    return locationFeatures.map((f: FeatureItem) => ({
      feature: f,
      displayName: String(f.properties?.name ?? f.properties?.title ?? f.id ?? 'Unnamed'),
      coordinates: formatCoordinates(f.geometry),
    }));
  }, [locationFeatures]);

  const filteredLocations = useMemo(() => {
    if (!query) return allLocations;
    return allLocations.filter(loc => matchLocation(loc, query));
  }, [allLocations, query]);

  // Auto-switch away from locations tab when it becomes unavailable
  useEffect(() => {
    if (activeTab === 'locations' && !locationsEnabled) {
      setActiveTab('collections');
    }
  }, [locationsEnabled, activeTab]);

  // Cross-popover coordination
  useEffect(() => {
    const handleClose = () => setOpen(false);
    const handleToggle = () => setOpen(prev => !prev);
    document.addEventListener('close-search-popover', handleClose);
    document.addEventListener('toggle-search-popover', handleToggle);
    return () => {
      document.removeEventListener('close-search-popover', handleClose);
      document.removeEventListener('toggle-search-popover', handleToggle);
    };
  }, []);

  const handleOpen = useCallback(() => {
    document.dispatchEvent(new Event('close-validation-popover'));
    document.dispatchEvent(new Event('close-layers-popover'));
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Focus input after popover opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      // highlightedIndex is reset by useSearchNavigation when query/activeTab/filters change
    }
  }, [open]);

  const toggleFilter = useCallback((field: FilterField) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        // Don't allow removing all filters
        if (next.size > 1) next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((index: number) => {
    // -1 is used as a signal for keyboard navigation (not actual selection)
    if (index === -1) return;

    if (activeTab === 'services') {
      const svc = filteredServices[index];
      if (!svc) return;
      setSelectedServiceUrl(svc.url);
      setTimeout(() => setSelectedServiceUrl(null), 100);
      setActiveTab('collections');
      setQuery('');
      inputRef.current?.focus();
      return; // skip handleClose() below
    } else if (activeTab === 'collections') {
      const result = filteredCollections[index];
      if (!result) return;
      // Skip if already the active collection (would toggle it off)
      if (result.collection.id !== selectedCollection?.id) {
        selectCollectionByIndexRef.current?.(result.originalIndex);
      }
      // Don't close — auto-switch to best available tab
      const col = result.collection;
      if (hasLocationQuery(col)) {
        setActiveTab('locations');
      } else {
        setActiveTab('items');
      }
      setQuery('');
      inputRef.current?.focus();
      return; // skip handleClose() below
    } else if (activeTab === 'items') {
      const item = filteredItems[index];
      if (!item) return;
      const featureLayer = {
        url: `selected-item-${Date.now()}`,
        title: `Selected: ${item.displayName}`,
        visible: true,
        data: { type: 'FeatureCollection' as const, features: [item.feature] },
      };
      const nonSelected = geoJsonLayers.filter(l => !l.title.startsWith('Selected: '));
      setGeoJsonLayers([...nonSelected, featureLayer]);
    } else if (activeTab === 'locations') {
      const loc = filteredLocations[index];
      if (!loc) return;
      setSelectedFeature(loc.feature);
      const featureLayer = {
        url: `selected-location-${Date.now()}`,
        title: `Selected: ${loc.displayName}`,
        visible: true,
        data: { type: 'FeatureCollection' as const, features: [loc.feature] },
      };
      const nonSelected = geoJsonLayers.filter(l => !l.title.startsWith('Selected: '));
      setGeoJsonLayers([...nonSelected, featureLayer]);
    }
    handleClose();
  }, [activeTab, filteredServices, filteredCollections, filteredItems, filteredLocations, selectedCollection?.id, setSelectedServiceUrl, selectCollectionByIndexRef, geoJsonLayers, setGeoJsonLayers, setSelectedFeature, handleClose]);

  // Keyboard navigation
  const {
    highlightedIndex,
    isKeyboardNav,
    setIsKeyboardNav,
    handleKeyDown,
  } = useSearchNavigation({
    activeTab,
    setActiveTab,
    query,
    filters,
    resultCounts: {
      services: filteredServices.length,
      collections: filteredCollections.length,
      items: filteredItems.length,
      locations: filteredLocations.length,
    },
    itemsEnabled,
    locationsEnabled,
    onSelect: handleSelect,
    onClose: handleClose,
  });

  const searchContent = (
    <SearchContent
      query={query}
      setQuery={setQuery}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      filters={filters}
      toggleFilter={toggleFilter}
      filteredServices={filteredServices}
      filteredCollections={filteredCollections}
      filteredItems={filteredItems}
      filteredLocations={filteredLocations}
      serviceCount={filteredServices.length}
      collectionCount={filteredCollections.length}
      itemCount={filteredItems.length}
      locationCount={filteredLocations.length}
      itemsLoading={itemsLoading}
      itemsError={itemsError}
      itemsEnabled={itemsEnabled}
      locationsEnabled={locationsEnabled}
      isRecordCollection={isRecordCollection}
      itemsOffset={itemsOffset}
      itemsTotal={itemsTotal}
      itemsPageSize={itemsPageSize}
      itemsPageCount={itemsPageCount}
      onItemsNextPage={handleItemsNextPage}
      onItemsPrevPage={handleItemsPrevPage}
      selectedCollectionId={selectedCollection?.id ?? null}
      selectedCollectionName={selectedCollection?.title || selectedCollection?.id || null}
      highlightedIndex={highlightedIndex}
      onSelect={handleSelect}
      onKeyDown={handleKeyDown}
      onClose={handleClose}
      isDesktop={isDesktop}
      isKeyboardNav={isKeyboardNav}
      setIsKeyboardNav={setIsKeyboardNav}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      inputRef={inputRef}
      listRef={listRef}
    />
  );

  if (isDesktop) {
    return (
      <ClickAwayListener onClickAway={() => { if (open) handleClose(); }}>
        <Box sx={{ flexGrow: 1, maxWidth: 320, ml: 'auto' }}>
        {/* Search box in top bar — static trigger or real input */}
        <Box
          ref={setAnchorEl}
          onClick={() => { if (!open) handleOpen(); }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: open ? 0 : 1.5,
            py: open ? 0 : 0.5,
            borderRadius: 2,
            border: open ? 'none' : '1px solid rgba(255,255,255,0.3)',
            bgcolor: open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
            cursor: open ? 'text' : 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
            '&:hover': {
              bgcolor: open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.18)',
              borderColor: 'rgba(255,255,255,0.5)',
            },
          }}
        >
          {open ? (
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              placeholder="Search collections, services..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {query && (
                        <IconButton size="small" onClick={() => setQuery('')} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                      {activeTab === 'collections' && (
                        <IconButton
                          size="small"
                          onClick={() => setShowFilters(prev => !prev)}
                          sx={{ color: showFilters ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}
                        >
                          <FilterListIcon fontSize="small" />
                        </IconButton>
                      )}
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  color: '#fff',
                  fontSize: '0.8rem',
                  '& fieldset': { border: '1px solid rgba(255,255,255,0.5)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.7)' },
                  '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.8)' },
                },
                '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
              }}
            />
          ) : (
            <>
              <SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', flex: 1, fontSize: '0.8rem' }}>
                Search...
              </Typography>
              <Box
                component="kbd"
                sx={{
                  px: 0.75,
                  py: '1px',
                  borderRadius: 0.5,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'inherit',
                  lineHeight: 1.4,
                }}
              >
                /
              </Box>
            </>
          )}
        </Box>

          <Popper
            open={open}
            anchorEl={anchorEl}
            placement="bottom-end"
            style={{ zIndex: 1300 }}
            disablePortal={false}
          >
            <Paper
              elevation={8}
              sx={{ width: 500, maxHeight: 480, display: 'flex', flexDirection: 'column', overflow: 'hidden', mt: 0.5 }}
            >
              {searchContent}
            </Paper>
          </Popper>
        </Box>
      </ClickAwayListener>
    );
  }

  // Mobile: icon button + full-screen dialog
  return (
    <>
      <IconButton
        size="small"
        color="inherit"
        aria-label="search"
        onClick={handleOpen}
        sx={{ ml: 'auto' }}
      >
        <SearchIcon />
      </IconButton>

      <Dialog
        open={open}
        onClose={handleClose}
        fullScreen
        slotProps={{
          paper: {
            sx: { display: 'flex', flexDirection: 'column' },
          },
        }}
      >
        {searchContent}
      </Dialog>
    </>
  );
};

export default CommandPalette;
