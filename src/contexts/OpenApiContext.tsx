import { createContext, useContext, useEffect, useState, type ReactNode, type SetStateAction } from 'react';
import axios from 'axios';
import { useService } from './ServiceContext';
import { useCollection } from './CollectionContext';
import { useValidation } from './ValidationContext';
import { loadServiceDescription, type ServiceDescription } from '../validation/openapi/loadServiceDescription';
import { buildOperationIndex, type OperationIndex } from '../validation/openapi/operationIndex';
import { validateOpenApiStructure } from '../validation/openapi/validateStructure';
import { lintOpenApiForEdr } from '../validation/openapi/lintEdr';
import { allSectionsValid, isProblem } from '../validation/severity';
import type { ValidationError, ValidationResult } from '../types/api';

// The service's API definition (service-desc): loaded and indexed for checking requests, then
// validated (OpenAPI schema + EDR consistency) into the "API definition" validation section
export interface OpenApiState {
  status: 'none' | 'loading' | 'ready' | 'error';
  url: string | null;
  description: ServiceDescription | null;
  index: OperationIndex | null;
  error: string | null;
}

const NONE: OpenApiState = { status: 'none', url: null, description: null, index: null, error: null };

const OpenApiContext = createContext<OpenApiState>(NONE);

type OpenApiSection = NonNullable<ValidationResult['openApiValidation']>;

function mergeSection(setValidationResult: (update: SetStateAction<ValidationResult>) => void, section: OpenApiSection) {
  setValidationResult(prev => {
    const errors = [...(prev.errors ?? []).filter(error => error.section !== 'OpenAPI'), ...(section.errors ?? [])];
    const next = { ...prev, openApiValidation: section, errors: errors.length > 0 ? errors : null };
    return { ...next, isValid: allSectionsValid(next) };
  });
}

// A description that can't be loaded is reported, but isn't a flaw in the document
function unavailable(error: unknown): ValidationError {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return {
    message: status
      ? `The API definition could not be loaded (HTTP ${status})`
      : `The API definition could not be loaded (${error instanceof Error ? error.message : 'network or CORS error'})`,
    section: 'OpenAPI',
    schema: 'OpenAPI',
    keyword: 'unavailable',
    severity: status === 404 ? 'warning' : 'info',
    type: status ? 'unknown' : 'network',
  };
}

const whenIdle = (callback: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
};

export function OpenApiProvider({ children }: { children: ReactNode }) {
  const { serviceDescUrl, getAuthCredentials } = useService();
  const { collections } = useCollection();
  const { setValidationResult, setEndpointUrls, setRawResponses } = useValidation();
  const [state, setState] = useState<OpenApiState>(NONE);

  // Load and index the description whenever the service's service-desc URL changes
  useEffect(() => {
    if (!serviceDescUrl) {
      setState(NONE);
      return;
    }
    let cancelled = false;
    setState({ ...NONE, status: 'loading', url: serviceDescUrl });
    loadServiceDescription(serviceDescUrl, getAuthCredentials(serviceDescUrl))
      .then(description => {
        if (cancelled) return;
        setState({ status: 'ready', url: serviceDescUrl, description, index: buildOperationIndex(description), error: null });
      })
      .catch(error => {
        if (cancelled) return;
        setState({ ...NONE, status: 'error', url: serviceDescUrl, error: error instanceof Error ? error.message : String(error) });
        const problem = unavailable(error);
        mergeSection(setValidationResult, { isValid: !isProblem(problem), errors: [problem], schemaResults: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [serviceDescUrl, getAuthCredentials, setValidationResult]);

  // Validate it once the collections it should describe are loaded, without blocking the UI
  useEffect(() => {
    const { description, index } = state;
    if (state.status !== 'ready' || !description || !index || collections.length === 0) return;
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      validateOpenApiStructure(description.doc)
        .then(structure => {
          if (cancelled) return;
          const lint = lintOpenApiForEdr(index, description.doc, collections);
          const errors = [...structure.errors, ...lint];
          mergeSection(setValidationResult, {
            isValid: !errors.some(isProblem),
            errors: errors.length > 0 ? errors : null,
            schemaResults: [
              { schema: structure.schemaName, isValid: !structure.errors.some(isProblem) },
              { schema: 'EDR consistency', isValid: !lint.some(isProblem) },
            ],
          });
          setEndpointUrls(prev => ({ ...prev, openApi: description.url }));
          setRawResponses(prev => ({ ...prev, openApi: description.doc }));
        })
        .catch(error => console.error('API definition validation failed:', error));
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [state, collections, setValidationResult, setEndpointUrls, setRawResponses]);

  return <OpenApiContext.Provider value={state}>{children}</OpenApiContext.Provider>;
}

export function useOpenApi(): OpenApiState {
  return useContext(OpenApiContext);
}
