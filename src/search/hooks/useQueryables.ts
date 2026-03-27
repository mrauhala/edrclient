import { useState, useEffect, useRef } from 'react';
import type { Collection } from '../../types/api';
import { fetchQueryables } from '../../api/queryables';
import type { QueryablesSchema } from '../../api/queryables';
import { useService } from '../../contexts/ServiceContext';

interface UseQueryablesReturn {
  queryables: QueryablesSchema | null;
  queryablesLoading: boolean;
  queryablesSupported: boolean;
}

/**
 * Thin React hook wrapping the queryables API.
 * Fetches queryables when enabled and collection changes.
 */
export function useQueryables(
  collection: Collection | null,
  enabled: boolean
): UseQueryablesReturn {
  const { getAuthCredentials } = useService();
  const [queryables, setQueryables] = useState<QueryablesSchema | null>(null);
  const [queryablesLoading, setQueryablesLoading] = useState(false);
  // Track support per collection ID to avoid re-fetching after 404
  const supportedRef = useRef<Map<string, boolean>>(new Map());

  // Reset support tracking when collection changes
  const collectionId = collection?.id ?? null;

  useEffect(() => {
    if (!enabled || !collection || !collectionId) {
      setQueryables(null);
      setQueryablesLoading(false);
      return;
    }

    // If we already know this collection doesn't support queryables, skip
    if (supportedRef.current.get(collectionId) === false) {
      setQueryables(null);
      setQueryablesLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setQueryablesLoading(true);
      try {
        const auth = getAuthCredentials('');
        const result = await fetchQueryables(collection, auth, controller.signal);
        if (cancelled) return;

        setQueryables(result);
        supportedRef.current.set(collectionId, result !== null);
      } catch {
        if (!cancelled) {
          setQueryables(null);
          supportedRef.current.set(collectionId, false);
        }
      } finally {
        if (!cancelled) setQueryablesLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [collection, collectionId, enabled, getAuthCredentials]);

  const queryablesSupported = collectionId !== null
    ? supportedRef.current.get(collectionId) !== false
    : false;

  return { queryables, queryablesLoading, queryablesSupported };
}
