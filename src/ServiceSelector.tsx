import React, { useEffect, useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import ListItemIcon from '@mui/material/ListItemIcon';
import Person from '@mui/icons-material/Person';
import Lock from '@mui/icons-material/Lock';
import { getCollections, GetCollectionsResult } from './DataRetrievalAPI';
import SchemaInspector from './SchemaInspector';
import SwaggerUIViewer from './SwaggerUIViewer';
import ConformanceViewer from './ConformanceViewer';
import { useService } from './contexts/ServiceContext';
import systemServices from './config/services.json';
import { ServiceType, ServiceDefinition } from './types/ServiceType';
import { SERVICE_TYPE_CONFIG, SERVICE_TYPE_ORDER } from './config/serviceTypeConfig';

const typedSystemServices: ServiceDefinition[] = systemServices as ServiceDefinition[];

const DEFAULT_SERVICE_URL = typedSystemServices.find(s => s.type === ServiceType.EDR && s.label === 'FMI Open Data')?.url
  ?? typedSystemServices[0]?.url
  ?? '';

interface ServiceSelectorProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  onBeforeLoad: () => void;
  onLoadResult: (result: GetCollectionsResult) => void;
  onLoadError: (error: Error) => void;
  onApiUrlChange: (url: string) => void;
  selectedConformanceUrl: string | null;
  setSelectedConformanceUrl: (url: string | null) => void;
  landingPageTitle: string | null;
  serviceDescUrl: string | null;
  setServiceDescUrl: (url: string | null) => void;
}

const ServiceSelector = ({
  isLoading,
  setIsLoading,
  onBeforeLoad,
  onLoadResult,
  onLoadError,
  onApiUrlChange,
  selectedConformanceUrl,
  setSelectedConformanceUrl,
  landingPageTitle,
  serviceDescUrl,
  setServiceDescUrl,
}: ServiceSelectorProps) => {
  const { customServices, getAuthCredentials, selectedServiceUrl: onServiceUrlSelect } = useService();

  const [apiUrl, setApiUrl] = useState(DEFAULT_SERVICE_URL);
  const [selectedService, setSelectedService] = useState(DEFAULT_SERVICE_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_SERVICE_URL);
  const [validationTrigger, setValidationTrigger] = useState(0);

  // Effect to handle external service URL selection (from settings)
  useEffect(() => {
    if (onServiceUrlSelect) {
      setSelectedService(onServiceUrlSelect);
      setInputUrl(onServiceUrlSelect);
      setApiUrl(onServiceUrlSelect);
    }
  }, [onServiceUrlSelect]);

  // Grouped system services by type
  const groupedSystemServices = useMemo(() => {
    const groups = new Map<ServiceType, ServiceDefinition[]>();
    for (const svc of typedSystemServices) {
      const list = groups.get(svc.type) || [];
      list.push(svc);
      groups.set(svc.type, list);
    }
    for (const [, list] of groups) {
      list.sort((a, b) => a.label.localeCompare(b.label));
    }
    return groups;
  }, []);

  // Custom service items
  const customServiceItems = useMemo(() =>
    [...customServices]
      .map(service => ({
        label: service.name,
        url: service.url,
        hasAuth: !!(service.username || service.password || service.apiKey || service.bearerToken),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [customServices]
  );

  // Flat lookup: URL → ServiceDefinition (for renderValue)
  const serviceByUrl = useMemo(() => {
    const map = new Map<string, ServiceDefinition>();
    for (const svc of typedSystemServices) {
      map.set(svc.url, svc);
    }
    return map;
  }, []);

  // All URLs for matching input to selection
  const allServiceUrls = useMemo(() => {
    const urls = new Set(typedSystemServices.map(s => s.url));
    for (const cs of customServiceItems) urls.add(cs.url);
    return urls;
  }, [customServiceItems]);

  // Notify parent when apiUrl changes (for auth lookups)
  useEffect(() => {
    onApiUrlChange(apiUrl);
  }, [apiUrl, onApiUrlChange]);

  // Debounce effect for text input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputUrl !== apiUrl) {
        setApiUrl(inputUrl);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [inputUrl, apiUrl]);

  // Load collections when apiUrl changes
  useEffect(() => {
    async function loadCollections() {
      setIsLoading(true);
      onBeforeLoad();
      setServiceDescUrl(null);

      try {
        console.log('Loading collections from:', apiUrl);
        const result = await getCollections(apiUrl, getAuthCredentials(apiUrl));
        setServiceDescUrl(result.serviceDescUrl || null);
        onLoadResult(result);
      } catch (error) {
        console.error('Error loading collections:', error);
        onLoadError(error instanceof Error ? error : new Error('Unknown error loading collections'));
      } finally {
        setIsLoading(false);
      }
    }

    loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, validationTrigger]);

  function handleApiUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newUrl = event.target.value;
    setInputUrl(newUrl);
    if (allServiceUrls.has(newUrl)) {
      setSelectedService(newUrl);
    } else {
      setSelectedService('');
    }
  }

  const handleServiceChange = (event: SelectChangeEvent) => {
    const newService = event.target.value;
    setSelectedService(newService);
    if (newService !== '') {
      setInputUrl(newService);
      setApiUrl(newService);
    }
  };

  const handleValidateClick = () => {
    setApiUrl(inputUrl);
    setValidationTrigger(prev => prev + 1);
  };

  function renderServiceChip(type: ServiceType, size: 'small' | 'medium' = 'small') {
    const config = SERVICE_TYPE_CONFIG[type];
    return (
      <Chip
        label={config.abbreviation}
        size={size}
        sx={{
          bgcolor: config.color,
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.7rem',
          height: size === 'small' ? 20 : 24,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    );
  }

  function renderGroupHeader(type: ServiceType) {
    return (
      <ListSubheader
        key={`header-${type}`}
        sx={{
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'text.secondary',
          lineHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {renderServiceChip(type)}
        {type}
      </ListSubheader>
    );
  }

  return (
    <Box sx={{ padding: 2, minWidth: 120, borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="service-select-label">OGC API Service</InputLabel>
        <Select
          labelId="service-select-label"
          id="service-select"
          value={selectedService}
          label="OGC API Service"
          onChange={handleServiceChange}
          renderValue={(value) => {
            const systemSvc = serviceByUrl.get(value);
            if (systemSvc) {
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {renderServiceChip(systemSvc.type)}
                  <span>{systemSvc.label}</span>
                </Box>
              );
            }
            const customSvc = customServiceItems.find(s => s.url === value);
            if (customSvc) {
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person fontSize="small" color="primary" />
                  <span>{customSvc.label}</span>
                  {customSvc.hasAuth && (
                    <Lock fontSize="small" sx={{ ml: 'auto', opacity: 0.6 }} />
                  )}
                </Box>
              );
            }
            return <span>Custom</span>;
          }}
        >
          {/* System services grouped by type */}
          {SERVICE_TYPE_ORDER.map(type => {
            const items = groupedSystemServices.get(type);
            if (!items?.length) return null;
            return [
              renderGroupHeader(type),
              ...items.map(svc => (
                <MenuItem key={svc.url} value={svc.url}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {renderServiceChip(svc.type)}
                    {svc.label}
                  </Box>
                </MenuItem>
              )),
            ];
          })}

          {/* Custom services group */}
          {customServiceItems.length > 0 && [
            <ListSubheader
              key="header-custom"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'text.secondary',
                lineHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Person fontSize="small" color="primary" />
              Custom Services
            </ListSubheader>,
            ...customServiceItems.map(svc => (
              <MenuItem
                key={svc.url}
                value={svc.url}
                sx={{ color: 'primary.main' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Person fontSize="small" color="primary" />
                  </ListItemIcon>
                  {svc.label}
                </Box>
                {svc.hasAuth && (
                  <Lock fontSize="small" sx={{ ml: 1, opacity: 0.6 }} />
                )}
              </MenuItem>
            )),
          ]}

          {/* Manual URL entry option */}
          <MenuItem key="custom" value="">
            Custom
          </MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        id="apiUrl"
        label="API URL"
        value={inputUrl}
        variant="outlined"
        onChange={handleApiUrlChange}
        helperText="Validation will trigger 1 second after you stop typing"
      />
      <Button
        variant="contained"
        sx={{ mt: 1, mr: 1 }}
        disabled={isLoading}
        onClick={handleValidateClick}
      >
        {isLoading ? 'Loading...' : 'Validate'}
      </Button>
      <SwaggerUIViewer
        serviceDescUrl={serviceDescUrl}
        serviceName={landingPageTitle || undefined}
      />
      <ConformanceViewer
        conformanceUrl={selectedConformanceUrl}
        onClose={() => setSelectedConformanceUrl(null)}
      />
      <SchemaInspector />
    </Box>
  );
};

export default ServiceSelector;
