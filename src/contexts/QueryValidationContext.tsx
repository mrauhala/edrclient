import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { QueryIssue } from '../query/types';

// Validation of the data query the builder produced, tagged with the URL it was made for. Other
// panels (Maps, collection selection) also set the request URL, so consumers ignore issues whose
// URL is no longer the current one.
export interface QueryValidationState {
  url: string;
  issues: QueryIssue[];
  // The API definition's operation the URL was checked against, if the service has one that matches,
  // with the query parameters it requires
  apiOperation: { template: string; pointer: string; required: string[] } | null;
}

interface QueryValidationContextValue {
  queryValidation: QueryValidationState | null;
  setQueryValidation: (validation: QueryValidationState | null) => void;
}

const QueryValidationContext = createContext<QueryValidationContextValue | null>(null);

export function QueryValidationProvider({ children }: { children: ReactNode }) {
  const [queryValidation, setQueryValidation] = useState<QueryValidationState | null>(null);
  const value = useMemo(() => ({ queryValidation, setQueryValidation }), [queryValidation]);
  return <QueryValidationContext.Provider value={value}>{children}</QueryValidationContext.Provider>;
}

export function useQueryValidationContext() {
  const context = useContext(QueryValidationContext);
  if (!context) {
    throw new Error('useQueryValidationContext must be used within a QueryValidationProvider');
  }
  return context;
}
