import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useCollection } from '../../contexts/CollectionContext';
import { useService } from '../../contexts/ServiceContext';
import { getAxiosConfig, addApiKeyToUrl } from '../../api/auth';
import { normalizeHref } from '../../DataRetrievalAPI';
import type { ActiveTab, FeatureItem, ItemResult } from '../types';
import { matchItem } from '../matching';
import { useQueryables } from './useQueryables';
import type { QueryablesSchema } from '../../api/queryables';

const ITEMS_PAGE_SIZE = 200;

/** Find the first property whose key contains "name" (case-insensitive). */
function getNameProperty(properties: Record<string, unknown> | undefined): string | null {
  if (!properties) return null;
  for (const [key, val] of Object.entries(properties)) {
    if (key.toLowerCase().includes('name') && val != null && val !== '') {
      return String(val);
    }
  }
  return null;
}

interface UseItemsFetchParams {
  query: string;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

interface UseItemsFetchReturn {
  filteredItems: ItemResult[];
  itemsLoading: boolean;
  itemsError: string | null;
  itemsEnabled: boolean;
  isRecordCollection: boolean;
  itemsUrl: string | null;
  itemsOffset: number;
  itemsTotal: number | null;
  itemsPageSize: number;
  itemsPageCount: number;
  handleItemsNextPage: () => void;
  handleItemsPrevPage: () => void;
  queryablesSupported: boolean;
  queryables: QueryablesSchema | null;
  queryablesLoading: boolean;
  itemFilters: Record<string, string>;
  setItemFilter: (property: string, value: string) => void;
  removeItemFilter: (property: string) => void;
  clearItemFilters: () => void;
  loadedItems: FeatureItem[];
}

export function useItemsFetch({ query, activeTab, setActiveTab }: UseItemsFetchParams): UseItemsFetchReturn {
  const { selectedCollection } = useCollection();
  const { getAuthCredentials } = useService();

  // Queryables
  const { queryablesSupported, queryables, queryablesLoading } = useQueryables(
    selectedCollection,
    activeTab === 'items'
  );

  // Server-side property filters (queryables)
  const [itemFilters, setItemFilters] = useState<Record<string, string>>({});

  // Items state
  const [items, setItems] = useState<FeatureItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsCollectionId, setItemsCollectionId] = useState<string | null>(null);
  const [itemsOffset, setItemsOffset] = useState(0);
  const [itemsTotal, setItemsTotal] = useState<number | null>(null);

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

  // Filter mutation callbacks
  const setItemFilter = useCallback((property: string, value: string) => {
    setItemFilters(prev => ({ ...prev, [property]: value }));
  }, []);

  const removeItemFilter = useCallback((property: string) => {
    setItemFilters(prev => {
      const next = { ...prev };
      delete next[property];
      return next;
    });
  }, []);

  const clearItemFilters = useCallback(() => {
    setItemFilters({});
  }, []);

  // Reset pagination when property filters change
  useEffect(() => {
    setItemsOffset(0);
    setItemsTotal(null);
  }, [itemFilters]);

  // Track q= parameter support per collection (true = supported, false = 400 error)
  const qSupportRef = useRef<Map<string, boolean>>(new Map());
  // Records always support q=; for Features, assume supported until proven otherwise
  const qSupported = isRecordCollection || (selectedCollection?.id != null && qSupportRef.current.get(selectedCollection.id) !== false);

  // Debounced query for server-side search (q= parameter)
  const [debouncedItemsQuery, setDebouncedItemsQuery] = useState('');
  useEffect(() => {
    if (!qSupported) return;
    const timer = setTimeout(() => setDebouncedItemsQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query, qSupported]);

  // Auto-switch away from items tab when it becomes unavailable
  useEffect(() => {
    if (activeTab === 'items' && !itemsUrl) {
      setActiveTab('collections');
    }
  }, [itemsUrl, activeTab, setActiveTab]);

  // Reset offset when server-side query changes
  useEffect(() => {
    if (qSupported) {
      setItemsOffset(0);
      setItemsTotal(null);
    }
  }, [debouncedItemsQuery, qSupported]);

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
        // Server-side text search via q= parameter (works on many OGC API implementations)
        if (qSupported && debouncedItemsQuery) {
          urlObj.searchParams.set('q', debouncedItemsQuery);
        }
        // OGC API Features: apply queryable property filters as URL params
        for (const [key, value] of Object.entries(itemFilters)) {
          urlObj.searchParams.set(key, value);
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
        // If q= caused a 400 error, mark this collection as not supporting q= and retry without it
        if (qSupported && debouncedItemsQuery && !isRecordCollection &&
            axios.isAxiosError(err) && err.response?.status === 400 &&
            selectedCollection) {
          qSupportRef.current.set(selectedCollection.id, false);
          // Retry without q= by re-triggering the effect (qSupported will now be false)
          setDebouncedItemsQuery('');
          return;
        }
        setItemsError(err instanceof Error ? err.message : 'Failed to fetch items');
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    };

    fetchItems();
    return () => { cancelled = true; };
  }, [activeTab, itemsUrl, selectedCollection, itemsCollectionId, itemsOffset, isRecordCollection, debouncedItemsQuery, itemFilters, qSupported, getAuthCredentials]);

  // Reset items when selected collection changes while not on items tab
  useEffect(() => {
    if (selectedCollection?.id !== itemsCollectionId) {
      setItems([]);
      setItemsCollectionId(null);
      setItemsError(null);
      setItemsOffset(0);
      setItemsTotal(null);
      setItemFilters({});
    }
  }, [selectedCollection?.id, itemsCollectionId]);

  // Pagination handlers
  const handleItemsNextPage = useCallback(() => {
    setItemsOffset(prev => prev + ITEMS_PAGE_SIZE);
  }, []);

  const handleItemsPrevPage = useCallback(() => {
    setItemsOffset(prev => Math.max(0, prev - ITEMS_PAGE_SIZE));
  }, []);

  // Filter items — server-side via q= when supported, client-side otherwise
  const filteredItems = useMemo(() => {
    const all: ItemResult[] = items.map(f => ({
      feature: f,
      displayName: String(f.properties?.name || f.properties?.title || f.properties?.label || f.properties?.nimi || getNameProperty(f.properties) || f.id || 'Unnamed'),
      geometryType: f.geometry?.type || 'No geometry',
    }));
    // Server-side search: results are already filtered
    if (qSupported) return all;
    if (!query) return all;
    return all.filter(item => matchItem(item, query));
  }, [items, query, qSupported]);

  return {
    filteredItems,
    itemsLoading,
    itemsError,
    itemsEnabled: !!itemsUrl,
    isRecordCollection,
    itemsUrl,
    itemsOffset,
    itemsTotal,
    itemsPageSize: ITEMS_PAGE_SIZE,
    itemsPageCount: items.length,
    handleItemsNextPage,
    handleItemsPrevPage,
    queryablesSupported,
    queryables,
    queryablesLoading,
    itemFilters,
    setItemFilter,
    removeItemFilter,
    clearItemFilters,
    loadedItems: items,
  };
}
