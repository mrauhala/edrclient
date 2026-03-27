import { useState, useEffect, useMemo } from 'react';
import type { Collection } from '../../types/api';
import { fetchQueryables, hasQueryablesLink } from '../../api/queryables';
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
 * `queryablesSupported` is derived from collection links — no fetch needed.
 */
export function useQueryables(
  collection: Collection | null,
  enabled: boolean
): UseQueryablesReturn {
  const { getAuthCredentials } = useService();
  const [queryables, setQueryables] = useState<QueryablesSchema | null>(null);
  const [queryablesLoading, setQueryablesLoading] = useState(false);

  // Detect support from collection links (no fetch needed)
  const queryablesSupported = useMemo(
    () => collection != null && hasQueryablesLink(collection),
    [collection]
  );

  useEffect(() => {
    if (!enabled || !collection || !queryablesSupported) {
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
      } catch {
        if (!cancelled) setQueryables(null);
      } finally {
        if (!cancelled) setQueryablesLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [collection, enabled, queryablesSupported, getAuthCredentials]);

  return { queryables, queryablesLoading, queryablesSupported };
}
