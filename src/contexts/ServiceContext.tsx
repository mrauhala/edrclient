import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CustomService } from '../types/CustomService';
import { AuthCredentials } from '../DataRetrievalAPI';

interface ServiceContextValue {
  customServices: CustomService[];
  getAuthCredentials: (url: string) => AuthCredentials | undefined;
  // The loaded API's OpenAPI document (service-desc). Here rather than in ApiContext because of the order
  // of the providers: loading resets the query builder, which uses the document through OpenApiProvider.
  serviceDescUrl: string | null;
  setServiceDescUrl: (url: string | null) => void;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  customServices: CustomService[];
}

export function ServiceProvider({ children, customServices }: ServiceProviderProps) {
  const [serviceDescUrl, setServiceDescUrl] = useState<string | null>(null);
  const getAuthCredentials = useMemo(() => {
    return (url: string): AuthCredentials | undefined => {
      const service = customServices.find(s => {
        try {
          const reqUrl = new URL(url);
          const svcUrl = new URL(s.url);
          return reqUrl.hostname === svcUrl.hostname
            && reqUrl.port === svcUrl.port
            && reqUrl.pathname.startsWith(svcUrl.pathname.replace(/\/$/, ''));
        } catch {
          // Fallback for invalid URLs
          return url.includes(s.url);
        }
      });
      if (service) {
        if (service.customAuthHeader) {
          return { customAuthHeader: service.customAuthHeader };
        } else if (service.bearerToken) {
          return { bearerToken: service.bearerToken };
        } else if (service.apiKey) {
          return { apiKey: service.apiKey, apiKeyParam: service.apiKeyParam };
        } else if (service.username) {
          return { username: service.username, password: service.password || '' };
        }
      }
      return undefined;
    };
  }, [customServices]);

  const value = useMemo(() => ({
    customServices,
    getAuthCredentials,
    serviceDescUrl,
    setServiceDescUrl,
  }), [customServices, getAuthCredentials, serviceDescUrl]);

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useService() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useService must be used within a ServiceProvider');
  }
  return context;
}
