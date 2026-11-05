import { createContext, useContext, type ReactNode } from 'react';
import { useQueryUrl, type UseQueryUrlReturn } from '../hooks/useQueryUrl';

const QueryBuilderContext = createContext<UseQueryUrlReturn | null>(null);

// The query being built. Up here rather than in the sidebar, so that the request URL can drive it too.
export function QueryBuilderProvider({ children }: { children: ReactNode }) {
  const queryState = useQueryUrl();
  return <QueryBuilderContext.Provider value={queryState}>{children}</QueryBuilderContext.Provider>;
}

export function useQueryBuilder() {
  const context = useContext(QueryBuilderContext);
  if (!context) throw new Error('useQueryBuilder must be used within a QueryBuilderProvider');
  return context;
}
