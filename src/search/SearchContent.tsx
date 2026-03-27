import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import DnsIcon from '@mui/icons-material/Dns';
import FolderIcon from '@mui/icons-material/Folder';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import PentagonIcon from '@mui/icons-material/Pentagon';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import HexagonIcon from '@mui/icons-material/Hexagon';
import ArticleIcon from '@mui/icons-material/Article';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckIcon from '@mui/icons-material/Check';
import { SERVICE_TYPE_CONFIG } from '../config/serviceTypeConfig';
import type { ActiveTab, FilterField, ServiceItem, CollectionResult, ItemResult, LocationResult, FeatureItem } from './types';
import { GEOMETRY_CHIP_COLORS } from './types';
import { highlightMatch, getPropertyPreview } from './matching';
import type { QueryablesSchema } from '../api/queryables';
import { QueryablesFilterPanel } from './QueryablesFilterPanel';
import { ActiveFiltersBar } from './ActiveFiltersBar';

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

function GeometryIcon({ type, color }: { type: string; color?: string }) {
  const sx = { fontSize: 20, color: color ?? GEOMETRY_CHIP_COLORS[type]?.color ?? 'text.secondary' };
  switch (type) {
    case 'Point': return <PlaceIcon sx={sx} />;
    case 'MultiPoint': return <ScatterPlotIcon sx={sx} />;
    case 'LineString':
    case 'MultiLineString': return <TimelineIcon sx={sx} />;
    case 'Polygon': return <PentagonIcon sx={sx} />;
    case 'MultiPolygon': return <HexagonIcon sx={sx} />;
    default: return <ArticleIcon sx={sx} />;
  }
}

export function SearchContent({
  query,
  setQuery,
  activeTab,
  setActiveTab,
  filters,
  toggleFilter,
  filteredServices,
  filteredCollections,
  filteredItems,
  filteredLocations,
  serviceCount,
  collectionCount,
  itemCount,
  locationCount,
  itemsLoading,
  itemsError,
  itemsEnabled,
  locationsEnabled,
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
  selectedCollectionName,
  onKeyDown,
  onClose,
  isDesktop,
  isKeyboardNav,
  setIsKeyboardNav,
  showFilters,
  setShowFilters,
  queryablesSupported,
  queryables,
  queryablesLoading,
  itemFilters,
  onSetItemFilter,
  onRemoveItemFilter,
  onClearItemFilters,
  loadedItems,
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
  filteredLocations: LocationResult[];
  serviceCount: number;
  collectionCount: number;
  itemCount: number;
  locationCount: number;
  itemsLoading: boolean;
  itemsError: string | null;
  itemsEnabled: boolean;
  locationsEnabled: boolean;
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
  selectedCollectionName: string | null;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClose: () => void;
  isDesktop: boolean;
  isKeyboardNav: boolean;
  setIsKeyboardNav: (v: boolean) => void;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  queryablesSupported: boolean;
  queryables: QueryablesSchema | null;
  queryablesLoading: boolean;
  itemFilters: Record<string, string>;
  onSetItemFilter: (property: string, value: string) => void;
  onRemoveItemFilter: (property: string) => void;
  onClearItemFilters: () => void;
  loadedItems: FeatureItem[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLUListElement | null>;
}) {

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, listRef]);

  const results = activeTab === 'services' ? filteredServices : activeTab === 'collections' ? filteredCollections : activeTab === 'locations' ? filteredLocations : filteredItems;

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
                    {(activeTab === 'collections' || (activeTab === 'items' && queryablesSupported)) && (
                      <IconButton
                        size="small"
                        onClick={() => setShowFilters(prev => !prev)}
                        color={showFilters || Object.keys(itemFilters).length > 0 ? 'primary' : 'default'}
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
          onChange={(_, v) => { setActiveTab(v); inputRef.current?.focus(); }}
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
            value="locations"
            title={!locationsEnabled ? 'Select a collection with location queries' : undefined}
            icon={<LocationOnIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={
              locationsEnabled
                ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>Locations <CountBadge count={locationCount} active={activeTab === 'locations'} /></Box>
                : 'Locations'
            }
            disabled={!locationsEnabled}
            sx={{ gap: 0.5 }}
          />
          <Tab
            value="items"
            title={!itemsEnabled ? 'Select a collection to browse items' : undefined}
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
        {/* Context bar: show active collection on Locations/Items tabs */}
        {(activeTab === 'locations' || activeTab === 'items') && selectedCollectionName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <FolderIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
              {selectedCollectionName}
            </Typography>
          </Box>
        )}
        {/* Queryables filter panel (Items tab) */}
        {activeTab === 'items' && showFilters && queryablesSupported && (
          <QueryablesFilterPanel
            queryables={queryables}
            queryablesLoading={queryablesLoading}
            activeFilters={itemFilters}
            onApplyFilter={onSetItemFilter}
            loadedItems={loadedItems}
          />
        )}
        {/* Active filters bar (Items tab, visible even when panel collapsed) */}
        {activeTab === 'items' && (
          <ActiveFiltersBar
            filters={itemFilters}
            onRemove={onRemoveItemFilter}
            onClearAll={onClearItemFilters}
          />
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
                : activeTab === 'locations'
                  ? query
                    ? `Matching locations (${filteredLocations.length})`
                    : `Locations (${filteredLocations.length})`
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
                    : !selectedCollectionId
                      ? ''
                      : activeTab === 'locations'
                        ? 'No locations in this collection'
                        : isRecordCollection
                          ? 'Type to search records'
                          : 'No items in this collection'}
            </Typography>
            {!query && (activeTab === 'locations' || activeTab === 'items') && !selectedCollectionId && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                <Link
                  component="button"
                  variant="caption"
                  onClick={() => setActiveTab('collections')}
                  sx={{ verticalAlign: 'baseline' }}
                >
                  Select a collection
                </Link>
                {' '}to browse {activeTab}
              </Typography>
            )}
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
        ) : activeTab === 'locations' ? (
          filteredLocations.map((loc, idx) => {
            const preview = getPropertyPreview(loc.feature.properties);
            return (
              <ListItemButton
                key={loc.feature.id != null ? String(loc.feature.id) : `loc-${idx}`}
                role="option"
                selected={idx === highlightedIndex}
                onClick={() => onSelect(idx)}
                sx={{ py: isDesktop ? 0.75 : 1.25, alignItems: 'flex-start' }}
              >
                <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                  <GeometryIcon type={loc.feature.geometry?.type ?? ''} />
                </ListItemIcon>
                <ListItemText
                  primary={highlightMatch(loc.displayName, query)}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                      {loc.coordinates && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                          {highlightMatch(loc.coordinates, query)}
                        </Typography>
                      )}
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
                  <GeometryIcon type={item.geometryType} />
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
