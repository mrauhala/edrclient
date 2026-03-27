import { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useCollection } from '../../contexts/CollectionContext';
import { useService } from '../../contexts/ServiceContext';
import { getAxiosConfig, addApiKeyToUrl } from '../../api/auth';
import { normalizeHref } from '../../DataRetrievalAPI';
import type { ActiveTab, FeatureItem, ItemResult } from '../types';
import { matchItem } from '../matching';
import { useQueryables } from './useQueryables';

const ITEMS_PAGE_SIZE = 200;

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
}

export function useItemsFetch({ query, activeTab, setActiveTab }: UseItemsFetchParams): UseItemsFetchReturn {
  const { selectedCollection } = useCollection();
  const { getAuthCredentials } = useService();

  // Queryables (Phase 4a: fetch schema for future structured filters)
  const { queryablesSupported } = useQueryables(
    selectedCollection,
    activeTab === 'items'
  );

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
  }, [itemsUrl, activeTab, setActiveTab]);

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

  // Pagination handlers
  const handleItemsNextPage = useCallback(() => {
    setItemsOffset(prev => prev + ITEMS_PAGE_SIZE);
  }, []);

  const handleItemsPrevPage = useCallback(() => {
    setItemsOffset(prev => Math.max(0, prev - ITEMS_PAGE_SIZE));
  }, []);

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
  };
}
