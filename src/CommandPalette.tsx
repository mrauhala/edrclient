import React, { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Popover from '@mui/material/Popover';
import Dialog from '@mui/material/Dialog';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import DnsIcon from '@mui/icons-material/Dns';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCollection } from './contexts/CollectionContext';
import { useService } from './contexts/ServiceContext';
import systemServices from './config/services.json';
import { ServiceDefinition } from './types/ServiceType';
import type { Collection } from './types/api';

const typedSystemServices: ServiceDefinition[] = systemServices as ServiceDefinition[];

type FilterField = 'title' | 'description' | 'keywords' | 'id';
type ActiveTab = 'services' | 'collections' | 'items';

const DEFAULT_FILTERS = new Set<FilterField>(['title', 'description', 'keywords', 'id']);

interface ServiceItem {
  label: string;
  url: string;
  isActive: boolean;
}

interface CollectionResult {
  collection: Collection;
  originalIndex: number;
  matchedKeywords: string[];
}

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
  serviceCount,
  collectionCount,
  highlightedIndex,
  onSelect,
  selectedCollectionId,
  onClose,
  isDesktop,
  isKeyboardNav,
  setIsKeyboardNav,
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
  serviceCount: number;
  collectionCount: number;
  highlightedIndex: number;
  onSelect: (index: number) => void;
  selectedCollectionId: string | null;
  onClose: () => void;
  isDesktop: boolean;
  isKeyboardNav: boolean;
  setIsKeyboardNav: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLUListElement | null>;
}) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tabOrder: ActiveTab[] = ['services', 'collections'];
    const resultCount = activeTab === 'services' ? filteredServices.length : filteredCollections.length;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setIsKeyboardNav(true);
        if (resultCount > 0) {
          const next = (highlightedIndex + 1) % resultCount;
          onSelect(-1); // signal to parent to update index
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
          onSelect(highlightedIndex);
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
  }, [activeTab, filteredServices.length, filteredCollections.length, highlightedIndex, onClose, onSelect, setActiveTab, setIsKeyboardNav]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, listRef]);

  const results = activeTab === 'services' ? filteredServices : filteredCollections;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search input */}
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
                {!isDesktop ? (
                  <IconButton size="small" onClick={onClose} edge="start">
                    <ArrowBackIcon />
                  </IconButton>
                ) : (
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                )}
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQuery('')} edge="end">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 }, '& fieldset': { border: 'none', borderBottom: 1, borderColor: 'divider' } }}
      />

      {/* Category tabs */}
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
          label="Items"
          disabled
          sx={{ gap: 0.5 }}
        />
      </Tabs>

      {/* Filter chips (Collections tab only) */}
      {activeTab === 'collections' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Search in:</Typography>
          {(['title', 'description', 'keywords', 'id'] as FilterField[]).map((field) => (
            <Chip
              key={field}
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
        {results.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {query
                ? `No results for "${query}"`
                : activeTab === 'services'
                  ? 'Type to search services'
                  : 'Type to search collections'}
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
              <ListItemIcon sx={{ minWidth: 36 }}>
                <DnsIcon sx={{ fontSize: 20, color: svc.isActive ? 'success.main' : 'text.secondary' }} />
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
        ) : (
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
        )}
      </List>

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
  const { activeServiceUrl, customServices, setSelectedServiceUrl } = useService();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('collections');
  const [filters, setFilters] = useState<Set<FilterField>>(new Set(DEFAULT_FILTERS));
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);

  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Build combined service list
  const allServices: ServiceItem[] = useMemo(() => {
    const items: ServiceItem[] = typedSystemServices.map(s => ({
      label: s.label,
      url: s.url,
      isActive: s.url === activeServiceUrl,
    }));
    for (const cs of customServices) {
      items.push({
        label: cs.name,
        url: cs.url,
        isActive: cs.url === activeServiceUrl,
      });
    }
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

  // Close on click outside (trigger + popover are both "inside")
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorEl?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, anchorEl]);

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
    }
    handleClose();
  }, [activeTab, filteredServices, filteredCollections, selectedCollection?.id, setSelectedServiceUrl, selectCollectionByIndexRef, handleClose]);

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
      serviceCount={filteredServices.length}
      collectionCount={filteredCollections.length}
      selectedCollectionId={selectedCollection?.id ?? null}
      highlightedIndex={highlightedIndex}
      onSelect={handleSelect}
      onClose={handleClose}
      isDesktop={isDesktop}
      isKeyboardNav={isKeyboardNav}
      setIsKeyboardNav={setIsKeyboardNav}
      inputRef={inputRef}
      listRef={listRef}
    />
  );

  if (isDesktop) {
    return (
      <>
        {/* Trigger: pill-shaped search box */}
        <Box
          ref={setAnchorEl}
          onClick={() => {
            if (open) {
              inputRef.current?.focus();
            } else {
              handleOpen();
            }
          }}
          sx={{
            flexGrow: 1,
            maxWidth: 320,
            ml: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.3)',
            bgcolor: 'rgba(255,255,255,0.1)',
            cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.18)',
              borderColor: 'rgba(255,255,255,0.5)',
            },
          }}
        >
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
        </Box>

        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={(_, reason) => {
            if (reason === 'backdropClick') return;
            handleClose();
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          disableAutoFocus
          disableEnforceFocus
          slotProps={{
            paper: {
              ref: popoverRef,
              sx: { width: 500, maxHeight: 480, display: 'flex', flexDirection: 'column' },
            },
          }}
        >
          {searchContent}
        </Popover>
      </>
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
