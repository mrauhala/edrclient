import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { CustomService } from '../types/CustomService';
import { AuthCredentials } from '../DataRetrievalAPI';

interface ServiceContextValue {
  customServices: CustomService[];
  getAuthCredentials: (url: string) => AuthCredentials | undefined;
  selectedServiceUrl: string | null;
  setSelectedServiceUrl: (url: string | null) => void;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  customServices: CustomService[];
  selectedServiceUrl: string | null;
  setSelectedServiceUrl: (url: string | null) => void;
}

export function ServiceProvider({ children, customServices, selectedServiceUrl, setSelectedServiceUrl }: ServiceProviderProps) {
  const getAuthCredentials = useMemo(() => {
    return (url: string): AuthCredentials | undefined => {
      const service = customServices.find(s => url.includes(s.url));
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
    selectedServiceUrl,
    setSelectedServiceUrl,
  }), [customServices, getAuthCredentials, selectedServiceUrl, setSelectedServiceUrl]);

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
