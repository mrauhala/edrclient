import { createContext, useContext, useState, useMemo, type ReactNode, type SetStateAction } from 'react';
import type { ValidationResult } from '../DataRetrievalAPI';

export interface EndpointUrls {
  landingPage?: string;
  collections?: string;
  conformance?: string;
  locations?: string;
}

export interface RawResponses {
  landingPage?: unknown;
  collections?: unknown;
  conformance?: unknown;
  locations?: unknown;
}

interface ValidationContextValue {
  validationResult: ValidationResult;
  setValidationResult: (result: SetStateAction<ValidationResult>) => void;
  endpointUrls: EndpointUrls;
  setEndpointUrls: (urls: SetStateAction<EndpointUrls>) => void;
  rawResponses: RawResponses;
  setRawResponses: (responses: SetStateAction<RawResponses>) => void;
}

const ValidationContext = createContext<ValidationContextValue | null>(null);

export function ValidationProvider({ children }: { children: ReactNode }) {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: null,
  });
  const [endpointUrls, setEndpointUrls] = useState<EndpointUrls>({});
  const [rawResponses, setRawResponses] = useState<RawResponses>({});

  const value = useMemo(
    () => ({ validationResult, setValidationResult, endpointUrls, setEndpointUrls, rawResponses, setRawResponses }),
    [validationResult, endpointUrls, rawResponses]
  );

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation(): ValidationContextValue {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidation must be used within a ValidationProvider');
  }
  return context;
}
