import React, { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Popper from '@mui/material/Popper';
import Paper from '@mui/material/Paper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Dialog from '@mui/material/Dialog';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import DnsIcon from '@mui/icons-material/Dns';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckIcon from '@mui/icons-material/Check';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import axios from 'axios';
import { useCollection } from './contexts/CollectionContext';
import { useService } from './contexts/ServiceContext';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { getAxiosConfig, addApiKeyToUrl } from './api/auth';
import { normalizeHref } from './DataRetrievalAPI';
import systemServices from './config/services.json';
import { ServiceDefinition, ServiceType } from './types/ServiceType';
import { SERVICE_TYPE_CONFIG, SERVICE_TYPE_ORDER } from './config/serviceTypeConfig';
import type { Collection } from './types/api';

const typedSystemServices: ServiceDefinition[] = systemServices as ServiceDefinition[];

type FilterField = 'title' | 'description' | 'keywords' | 'id';
type ActiveTab = 'services' | 'collections' | 'items';

const DEFAULT_FILTERS = new Set<FilterField>(['title', 'description', 'keywords', 'id']);

interface ServiceItem {
  label: string;
  url: string;
  type?: ServiceType;
  isActive: boolean;
}

interface CollectionResult {
  collection: Collection;
  originalIndex: number;
  matchedKeywords: string[];
}

interface FeatureItem {
  id?: string | number;
  type: string;
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
}

interface ItemResult {
  feature: FeatureItem;
  displayName: string;
  geometryType: string;
}

const GEOMETRY_CHIP_COLORS: Record<string, { bgcolor: string; borderColor: string; color: string }> = {
  Point: { bgcolor: '#e8f5e9', borderColor: '#a5d6a7', color: '#2e7d32' },
  MultiPoint: { bgcolor: '#e8f5e9', borderColor: '#a5d6a7', color: '#2e7d32' },
  LineString: { bgcolor: '#fff3e0', borderColor: '#ffcc80', color: '#e65100' },
  MultiLineString: { bgcolor: '#fff3e0', borderColor: '#ffcc80', color: '#e65100' },
  Polygon: { bgcolor: '#e3f2fd', borderColor: '#90caf9', color: '#1565c0' },
  MultiPolygon: { bgcolor: '#ede7f6', borderColor: '#b39ddb', color: '#4527a0' },
};

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Box component="mark" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', px: '1px', borderRadius: 0.5, fontWeight: 500 }}>
        {text.slice(idx, idx + query.length)}
      </Box>
      {text.slice(idx + query.length)}
    </>
  );
}

function matchCollection(c: Collection, query: string, filters: Set<FilterField>): { matches: boolean; matchedKeywords: string[] } {
  const lq = query.toLowerCase();
  const matchedKeywords: string[] = [];

  if (filters.has('title') && c.title?.toLowerCase().includes(lq)) {
    return { matches: true, matchedKeywords };
  }
  if (filters.has('description') && c.description?.toLowerCase().includes(lq)) {
    return { matches: true, matchedKeywords };
  }
  if (filters.has('keywords') && c.keywords) {
    for (const kw of c.keywords) {
      if (kw.toLowerCase().includes(lq)) {
        matchedKeywords.push(kw);
      }
    }
    if (matchedKeywords.length > 0) {
      return { matches: true, matchedKeywords };
    }
  }
  if (filters.has('id') && c.id.toLowerCase().includes(lq)) {
    return { matches: true, matchedKeywords };
  }
  return { matches: false, matchedKeywords: [] };
}

function matchService(s: { label: string; url: string }, query: string): boolean {
  const lq = query.toLowerCase();
  return s.label.toLowerCase().includes(lq) || s.url.toLowerCase().includes(lq);
}

function matchItem(item: ItemResult, query: string): boolean {
  const lq = query.toLowerCase();
  if (item.displayName.toLowerCase().includes(lq)) return true;
  if (item.geometryType.toLowerCase().includes(lq)) return true;
  if (item.feature.properties) {
    for (const val of Object.values(item.feature.properties)) {
      if (typeof val === 'string' && val.toLowerCase().includes(lq)) return true;
    }
  }
  if (item.feature.id != null && String(item.feature.id).toLowerCase().includes(lq)) return true;
  return false;
}

function getPropertyPreview(properties: Record<string, unknown> | undefined): string {
  if (!properties) return '';
  const skip = new Set(['name', 'title', 'description']);
  const parts: string[] = [];
  for (const [key, val] of Object.entries(properties)) {
    if (skip.has(key) || val == null || typeof val === 'object') continue;
    parts.push(`${key}: ${String(val)}`);
    if (parts.length >= 2) break;
  }
  return parts.join(' \u00b7 ');
}

function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        px: 0.5,
        borderRadius: '9px',
        fontSize: '0.65rem',
        fontWeight: 700,
        bgcolor: active ? 'primary.light' : 'action.selected',
        color: active ? 'primary.contrastText' : 'text.secondary',
      }}
    >
      {count}
    </Box>
  );
}

function SearchContent({
  query,
  setQuery,
  activeTab,
  setActiveTab,
  filters,
  toggleFilter,
  filteredServices,
  filteredCollections,
  filteredItems,
  serviceCount,
  collectionCount,
  itemCount,
  itemsLoading,
  itemsError,
  itemsEnabled,
  isRecordCollection,
  itemsOffset,
  itemsTotal,
  itemsPageSize,
  itemsPageCount,
  onItemsNextPage,
  onItemsPrevPage,
  highlightedIndex,
  onSelect,
  selectedCollectionId,
  onKeyDown,
  onClose,
  isDesktop,
  isKeyboardNav,
  setIsKeyboardNav,
  showFilters,
  setShowFilters,
  inputRef,
  listRef,
}: {
  query: string;
  setQuery: (q: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  filters: Set<FilterField>;
  toggleFilter: (f: FilterField) => void;
  filteredServices: ServiceItem[];
  filteredCollections: CollectionResult[];
  filteredItems: ItemResult[];
  serviceCount: number;
  collectionCount: number;
  itemCount: number;
  itemsLoading: boolean;
  itemsError: string | null;
  itemsEnabled: boolean;
  isRecordCollection: boolean;
  itemsOffset: number;
  itemsTotal: number | null;
  itemsPageSize: number;
  itemsPageCount: number;
  onItemsNextPage: () => void;
  onItemsPrevPage: () => void;
  highlightedIndex: number;
  onSelect: (index: number) => void;
  selectedCollectionId: string | null;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClose: () => void;
  isDesktop: boolean;
  isKeyboardNav: boolean;
  setIsKeyboardNav: (v: boolean) => void;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLUListElement | null>;
}) {

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, listRef]);

  const results = activeTab === 'services' ? filteredServices : activeTab === 'collections' ? filteredCollections : filteredItems;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Fixed header: search input (mobile only) + tabs + filter toggle */}
      <Box sx={{ flexShrink: 0 }}>
        {!isDesktop && (
          <TextField
            inputRef={inputRef}
            fullWidth
            size="small"
            placeholder="Search collections, services..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <IconButton size="small" onClick={onClose} edge="start">
                      <ArrowBackIcon />
                    </IconButton>
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {query && (
                      <IconButton size="small" onClick={() => setQuery('')} edge="end">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                    {activeTab === 'collections' && (
                      <IconButton
                        size="small"
                        onClick={() => setShowFilters(prev => !prev)}
                        color={showFilters ? 'primary' : 'default'}
                        edge="end"
                      >
                        <FilterListIcon fontSize="small" />
                      </IconButton>
                    )}
                  </InputAdornment>
                ),
              },
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 }, '& fieldset': { border: 'none', borderBottom: 1, borderColor: 'divider' } }}
          />
        )}

        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 36, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none', fontSize: '0.8rem' } }}
        >
          <Tab
            value="services"
            icon={<DnsIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>Services <CountBadge count={serviceCount} active={activeTab === 'services'} /></Box>}
            sx={{ gap: 0.5 }}
          />
          <Tab
            value="collections"
            icon={<FolderIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>Collections <CountBadge count={collectionCount} active={activeTab === 'collections'} /></Box>}
            sx={{ gap: 0.5 }}
          />
          <Tab
            value="items"
            icon={<ArticleIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={
              itemsEnabled
                ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>Items <CountBadge count={itemCount} active={activeTab === 'items'} /></Box>
                : 'Items'
            }
            disabled={!itemsEnabled}
            sx={{ gap: 0.5 }}
          />
        </Tabs>

        {activeTab === 'collections' && showFilters && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Search in:</Typography>
            {(['title', 'description', 'keywords', 'id'] as FilterField[]).map((field) => (
              <Chip
                key={field}
                icon={filters.has(field) ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
                label={field.charAt(0).toUpperCase() + field.slice(1)}
                size="small"
                variant={filters.has(field) ? 'filled' : 'outlined'}
                color={filters.has(field) ? 'primary' : 'default'}
                onClick={() => toggleFilter(field)}
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Results list */}
      <List
        ref={listRef as React.Ref<HTMLUListElement>}
        dense
        sx={{
          flex: 1, overflow: 'auto', py: 0,
          ...(isKeyboardNav && { '& .MuiListItemButton-root:hover': { bgcolor: 'transparent' } }),
        }}
        role="listbox"
        onMouseMove={() => { if (isKeyboardNav) setIsKeyboardNav(false); }}
      >
        {activeTab === 'items' && itemsLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 5, gap: 1.5 }}>
            <CircularProgress size={24} />
            <Typography variant="caption" color="text.secondary">Loading items...</Typography>
          </Box>
        )}
        {activeTab === 'items' && itemsError && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="error">{itemsError}</Typography>
          </Box>
        )}
        {!(activeTab === 'items' && (itemsLoading || itemsError)) && results.length > 0 && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 1.5,
              pt: 1.25,
              pb: 0.5,
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'text.disabled',
            }}
          >
            {activeTab === 'services'
              ? `Matching services (${filteredServices.length})`
              : activeTab === 'collections'
                ? `Matching collections (${filteredCollections.length})`
                : query
                  ? `${isRecordCollection ? 'Search results' : 'Matching items'} (${filteredItems.length})`
                  : `Items (${filteredItems.length})`}
          </Typography>
        )}
        {!(activeTab === 'items' && (itemsLoading || itemsError)) && results.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {query
                ? `No results for "${query}"`
                : activeTab === 'services'
                  ? 'Type to search services'
                  : activeTab === 'collections'
                    ? 'Type to search collections'
                    : isRecordCollection
                      ? 'Type to search records'
                      : 'No items in this collection'}
            </Typography>
            {query && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Try a different tab or search term
              </Typography>
            )}
          </Box>
        ) : activeTab === 'services' ? (
          filteredServices.map((svc, idx) => (
            <ListItemButton
              key={svc.url}
              role="option"
              selected={idx === highlightedIndex}
              onClick={() => onSelect(idx)}
              sx={{ py: isDesktop ? 0.75 : 1.25 }}
            >
              <ListItemIcon sx={{ minWidth: 42 }}>
                {svc.type && SERVICE_TYPE_CONFIG[svc.type] ? (
                  <Chip
                    label={SERVICE_TYPE_CONFIG[svc.type].abbreviation}
                    size="small"
                    sx={{
                      bgcolor: SERVICE_TYPE_CONFIG[svc.type].color,
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.65rem',
                      height: 20,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                ) : (
                  <DnsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={highlightMatch(svc.label, query)}
                secondary={highlightMatch(svc.url, query)}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
                secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
              />
              {svc.isActive && (
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 600, flexShrink: 0, ml: 1 }}>
                  active
                </Typography>
              )}
            </ListItemButton>
          ))
        ) : activeTab === 'collections' ? (
          filteredCollections.map((result, idx) => (
            <ListItemButton
              key={result.collection.id}
              role="option"
              selected={idx === highlightedIndex}
              onClick={() => onSelect(idx)}
              sx={{ py: isDesktop ? 0.75 : 1.25, alignItems: 'flex-start' }}
            >
              <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                <FolderIcon sx={{ fontSize: 20, color: result.collection.id === selectedCollectionId ? 'success.main' : 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={highlightMatch(result.collection.title || result.collection.id, query)}
                secondary={
                  <Box component="span">
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                      {result.collection.description
                        ? highlightMatch(
                            result.collection.description.length > 80
                              ? result.collection.description.slice(0, 80) + '...'
                              : result.collection.description,
                            query
                          )
                        : result.collection.id}
                    </Typography>
                    {result.matchedKeywords.length > 0 && (
                      <Box component="span" sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {result.matchedKeywords.slice(0, 5).map((kw) => (
                          <Chip
                            key={kw}
                            label={kw}
                            size="small"
                            variant="filled"
                            sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                }
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
                secondaryTypographyProps={{ component: 'div' }}
              />
              {result.collection.id === selectedCollectionId && (
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 600, flexShrink: 0, ml: 1, alignSelf: 'center' }}>
                  active
                </Typography>
              )}
            </ListItemButton>
          ))
        ) : !(itemsLoading || itemsError) ? (
          filteredItems.map((item, idx) => {
            const chipColors = GEOMETRY_CHIP_COLORS[item.geometryType];
            const preview = getPropertyPreview(item.feature.properties);
            return (
              <ListItemButton
                key={item.feature.id != null ? String(item.feature.id) : `item-${idx}`}
                role="option"
                selected={idx === highlightedIndex}
                onClick={() => onSelect(idx)}
                sx={{ py: isDesktop ? 0.75 : 1.25, alignItems: 'flex-start' }}
              >
                <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                  <ArticleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </ListItemIcon>
                <ListItemText
                  primary={highlightMatch(item.displayName, query)}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                      <Chip
                        label={item.geometryType}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          fontWeight: 500,
                          '& .MuiChip-label': { px: 0.75 },
                          ...(chipColors ? {
                            bgcolor: chipColors.bgcolor,
                            borderColor: chipColors.borderColor,
                            color: chipColors.color,
                          } : {}),
                        }}
                      />
                      {preview && (
                        <Typography component="span" variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>
                          {highlightMatch(preview, query)}
                        </Typography>
                      )}
                    </Box>
                  }
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItemButton>
            );
          })
        ) : null}
      </List>

      {/* Items pagination controls */}
      {activeTab === 'items' && !itemsLoading && !itemsError && itemsPageCount > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, px: 1.5, py: 0.5, borderTop: 1, borderColor: 'divider' }}>
          <IconButton
            size="small"
            onClick={onItemsPrevPage}
            disabled={itemsOffset === 0}
          >
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {itemsOffset + 1}–{itemsOffset + itemsPageCount}
            {itemsTotal != null && ` of ${itemsTotal}`}
          </Typography>
          <IconButton
            size="small"
            onClick={onItemsNextPage}
            disabled={itemsPageCount < itemsPageSize || (itemsTotal != null && itemsOffset + itemsPageCount >= itemsTotal)}
          >
            <NavigateNextIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Footer with keyboard hints (desktop only) */}
      {isDesktop && (
        <Box sx={{ display: 'flex', gap: 2, px: 1.5, py: 0.75, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
          {[
            { keys: '↑↓', label: 'navigate' },
            { keys: 'Enter', label: 'select' },
            { keys: 'Tab', label: 'switch tab' },
            { keys: 'Esc', label: 'close' },
          ].map(({ keys, label }) => (
            <Typography key={keys} variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box component="kbd" sx={{ px: 0.5, py: '1px', borderRadius: 0.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', fontSize: '0.6rem', fontFamily: 'inherit' }}>
                {keys}
              </Box>
              {label}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

const CommandPalette: React.FC = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { collections, selectedCollection, selectCollectionByIndexRef } = useCollection();
  const { activeServiceUrl, customServices, setSelectedServiceUrl, getAuthCredentials } = useService();
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('collections');
  const [filters, setFilters] = useState<Set<FilterField>>(new Set(DEFAULT_FILTERS));
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Items state
  const [items, setItems] = useState<FeatureItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsCollectionId, setItemsCollectionId] = useState<string | null>(null);
  const [itemsOffset, setItemsOffset] = useState(0);
  const [itemsTotal, setItemsTotal] = useState<number | null>(null);
  const ITEMS_PAGE_SIZE = 200;

  // Derive items URL and whether this is a Records collection
  const itemsUrl = useMemo(() => {
    if (!selectedCollection?.links) return null;
    const link = selectedCollection.links.find(
      (l) => (l.rel === 'items' || l.rel === 'http://www.opengis.net/def/rel/ogc/1.0/items')
        && l.type?.includes('geo+json')
    );
    return link ? normalizeHref(link.href) : null;
  }, [selectedCollection]);

  const isRecordCollection = selectedCollection?.itemType === 'record';

  // Debounced query for server-side search (Records only)
  const [debouncedItemsQuery, setDebouncedItemsQuery] = useState('');
  useEffect(() => {
    if (!isRecordCollection) return;
    const timer = setTimeout(() => setDebouncedItemsQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query, isRecordCollection]);

  // Auto-switch away from items tab when it becomes unavailable
  useEffect(() => {
    if (activeTab === 'items' && !itemsUrl) {
      setActiveTab('collections');
    }
  }, [itemsUrl, activeTab]);

  // Reset offset when server-side query changes (Records)
  useEffect(() => {
    if (isRecordCollection) {
      setItemsOffset(0);
      setItemsTotal(null);
    }
  }, [debouncedItemsQuery, isRecordCollection]);

  // Fetch items when items tab is activated, page changes, or server-side query changes
  useEffect(() => {
    if (activeTab !== 'items' || !itemsUrl || !selectedCollection) return;

    // If collection changed, reset pagination
    const collectionChanged = itemsCollectionId !== selectedCollection.id;
    if (collectionChanged) {
      setItemsOffset(0);
      setItemsTotal(null);
      setItemsCollectionId(selectedCollection.id);
    }

    const currentOffset = collectionChanged ? 0 : itemsOffset;

    let cancelled = false;
    const fetchItems = async () => {
      setItemsLoading(true);
      setItemsError(null);

      try {
        const auth = getAuthCredentials(itemsUrl);
        const urlObj = new URL(itemsUrl);
        urlObj.searchParams.set('limit', String(ITEMS_PAGE_SIZE));
        if (currentOffset > 0) {
          urlObj.searchParams.set('offset', String(currentOffset));
        }
        // OGC API Records: use q parameter for server-side text search
        if (isRecordCollection && debouncedItemsQuery) {
          urlObj.searchParams.set('q', debouncedItemsQuery);
        }
        const fetchUrl = addApiKeyToUrl(urlObj.toString(), auth);
        const response = await axios.get(fetchUrl, getAxiosConfig(auth));

        if (cancelled) return;

        const data = response.data;
        if (data && (data.type === 'FeatureCollection' || data.type === 'Feature')) {
          const features: FeatureItem[] = data.type === 'Feature' ? [data] : data.features || [];
          setItems(features);
          if (data.numberMatched != null) {
            setItemsTotal(data.numberMatched);
          } else if (features.length < ITEMS_PAGE_SIZE && currentOffset === 0) {
            // If first page has fewer items than limit, that's the total
            setItemsTotal(features.length);
          }
        } else {
          setItemsError('Invalid GeoJSON response');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setItemsError(err instanceof Error ? err.message : 'Failed to fetch items');
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    };

    fetchItems();
    return () => { cancelled = true; };
  }, [activeTab, itemsUrl, selectedCollection, itemsCollectionId, itemsOffset, isRecordCollection, debouncedItemsQuery, getAuthCredentials]);

  // Reset items when selected collection changes while not on items tab
  useEffect(() => {
    if (selectedCollection?.id !== itemsCollectionId) {
      setItems([]);
      setItemsCollectionId(null);
      setItemsError(null);
      setItemsOffset(0);
      setItemsTotal(null);
    }
  }, [selectedCollection?.id, itemsCollectionId]);

  const handleItemsNextPage = useCallback(() => {
    setItemsOffset(prev => prev + ITEMS_PAGE_SIZE);
  }, []);

  const handleItemsPrevPage = useCallback(() => {
    setItemsOffset(prev => Math.max(0, prev - ITEMS_PAGE_SIZE));
  }, []);

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

  // Filter items — server-side for Records (via q param), client-side for Features
  const filteredItems = useMemo(() => {
    const all: ItemResult[] = items.map(f => ({
      feature: f,
      displayName: String(f.properties?.name || f.properties?.title || f.id || 'Unnamed'),
      geometryType: f.geometry?.type || 'No geometry',
    }));
    // Records use server-side q parameter, so results are already filtered
    if (isRecordCollection) return all;
    if (!query) return all;
    return all.filter(item => matchItem(item, query));
  }, [items, query, isRecordCollection]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, activeTab, filters]);

  // Listen for highlight change events from SearchContent keyboard handler
  useEffect(() => {
    const handler = (e: Event) => {
      setHighlightedIndex((e as CustomEvent).detail);
    };
    document.addEventListener('search-highlight', handler);
    return () => document.removeEventListener('search-highlight', handler);
  }, []);

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
      // Small delay to ensure the input is mounted
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setHighlightedIndex(0);
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
    } else if (activeTab === 'collections') {
      const result = filteredCollections[index];
      if (!result) return;
      // Skip if already the active collection (would toggle it off)
      if (result.collection.id !== selectedCollection?.id) {
        selectCollectionByIndexRef.current?.(result.originalIndex);
      }
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
    }
    handleClose();
  }, [activeTab, filteredServices, filteredCollections, filteredItems, selectedCollection?.id, setSelectedServiceUrl, selectCollectionByIndexRef, geoJsonLayers, setGeoJsonLayers, handleClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tabOrder: ActiveTab[] = itemsUrl ? ['services', 'collections', 'items'] : ['services', 'collections'];
    const resultCount = activeTab === 'services' ? filteredServices.length : activeTab === 'collections' ? filteredCollections.length : filteredItems.length;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setIsKeyboardNav(true);
        if (resultCount > 0) {
          const next = (highlightedIndex + 1) % resultCount;
          document.dispatchEvent(new CustomEvent('search-highlight', { detail: next }));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsKeyboardNav(true);
        if (resultCount > 0) {
          const prev = highlightedIndex <= 0 ? resultCount - 1 : highlightedIndex - 1;
          document.dispatchEvent(new CustomEvent('search-highlight', { detail: prev }));
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(highlightedIndex);
        }
        break;
      case 'Tab':
        e.preventDefault();
        {
          const currentIdx = tabOrder.indexOf(activeTab);
          const nextIdx = e.shiftKey
            ? (currentIdx - 1 + tabOrder.length) % tabOrder.length
            : (currentIdx + 1) % tabOrder.length;
          setActiveTab(tabOrder[nextIdx]);
        }
        break;
    }
  }, [activeTab, filteredServices.length, filteredCollections.length, filteredItems.length, itemsUrl, highlightedIndex, handleClose, handleSelect, setIsKeyboardNav]);

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
      serviceCount={filteredServices.length}
      collectionCount={filteredCollections.length}
      itemCount={filteredItems.length}
      itemsLoading={itemsLoading}
      itemsError={itemsError}
      itemsEnabled={!!itemsUrl}
      isRecordCollection={isRecordCollection}
      itemsOffset={itemsOffset}
      itemsTotal={itemsTotal}
      itemsPageSize={ITEMS_PAGE_SIZE}
      itemsPageCount={items.length}
      onItemsNextPage={handleItemsNextPage}
      onItemsPrevPage={handleItemsPrevPage}
      selectedCollectionId={selectedCollection?.id ?? null}
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
