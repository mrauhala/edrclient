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

interface ServiceItem {
  label: string;
  url: string;
  type: ServiceType;
  isCustom: boolean;
  hasAuth: boolean;
}

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

  // Build typed custom service items
  const customServiceItems = useMemo(() =>
    customServices.map(service => ({
      label: service.name,
      url: service.url,
      type: service.type,
      hasAuth: !!(service.username || service.password || service.apiKey || service.bearerToken),
    })),
    [customServices]
  );

  // Typed custom services (have a ServiceType) — merged into type groups
  const typedCustomItems = useMemo(() =>
    customServiceItems.filter(s => s.type),
    [customServiceItems]
  );

  // Untyped custom services — go in "Custom Services" group
  const untypedCustomItems = useMemo(() =>
    customServiceItems
      .filter(s => !s.type)
      .sort((a, b) => a.label.localeCompare(b.label)),
    [customServiceItems]
  );

  // Grouped services by type: system + typed custom merged together
  const groupedServices = useMemo(() => {
    const groups = new Map<ServiceType, ServiceItem[]>();

    // Add system services
    for (const svc of typedSystemServices) {
      const list = groups.get(svc.type) || [];
      list.push({ ...svc, isCustom: false, hasAuth: false });
      groups.set(svc.type, list);
    }

    // Add typed custom services into the same groups
    for (const svc of typedCustomItems) {
      const type = svc.type!;
      const list = groups.get(type) || [];
      list.push({ label: svc.label, url: svc.url, type, isCustom: true, hasAuth: svc.hasAuth });
      groups.set(type, list);
    }

    // Sort each group alphabetically
    for (const [, list] of groups) {
      list.sort((a, b) => a.label.localeCompare(b.label));
    }

    return groups;
  }, [typedCustomItems]);

  // Flat lookup: URL → ServiceItem (for renderValue)
  const serviceByUrl = useMemo(() => {
    const map = new Map<string, ServiceItem>();
    for (const [, items] of groupedServices) {
      for (const item of items) {
        map.set(item.url, item);
      }
    }
    for (const svc of untypedCustomItems) {
      map.set(svc.url, { label: svc.label, url: svc.url, type: ServiceType.EDR, isCustom: true, hasAuth: svc.hasAuth });
    }
    return map;
  }, [groupedServices, untypedCustomItems]);

  // All URLs for matching input to selection
  const allServiceUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const [, items] of groupedServices) {
      for (const item of items) urls.add(item.url);
    }
    for (const svc of untypedCustomItems) urls.add(svc.url);
    return urls;
  }, [groupedServices, untypedCustomItems]);

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

  function renderServiceChip(type: ServiceType) {
    const config = SERVICE_TYPE_CONFIG[type];
    return (
      <Chip
        label={config.abbreviation}
        size="small"
        sx={{
          bgcolor: config.color,
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.7rem',
          height: 20,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    );
  }

  function renderServiceMenuItem(svc: ServiceItem) {
    return (
      <MenuItem key={svc.url} value={svc.url}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          {renderServiceChip(svc.type)}
          <span style={{ flex: 1 }}>{svc.label}</span>
          {svc.isCustom && (
            <Person fontSize="small" color="primary" sx={{ opacity: 0.7 }} />
          )}
          {svc.hasAuth && (
            <Lock fontSize="small" sx={{ opacity: 0.6 }} />
          )}
        </Box>
      </MenuItem>
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
            const svc = serviceByUrl.get(value);
            if (svc) {
              const isUntyped = untypedCustomItems.some(s => s.url === value);
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isUntyped ? (
                    <Person fontSize="small" color="primary" />
                  ) : (
                    renderServiceChip(svc.type)
                  )}
                  <span>{svc.label}</span>
                  {svc.isCustom && !isUntyped && (
                    <Person fontSize="small" color="primary" sx={{ opacity: 0.7 }} />
                  )}
                  {svc.hasAuth && (
                    <Lock fontSize="small" sx={{ ml: 'auto', opacity: 0.6 }} />
                  )}
                </Box>
              );
            }
            return <span>Custom</span>;
          }}
        >
          {/* Services grouped by type (system + typed custom merged) */}
          {SERVICE_TYPE_ORDER.map(type => {
            const items = groupedServices.get(type);
            if (!items?.length) return null;
            return [
              <ListSubheader
                key={`header-${type}`}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'text.secondary',
                  lineHeight: '32px',
                }}
              >
                {type}
              </ListSubheader>,
              ...items.map(svc => renderServiceMenuItem(svc)),
            ];
          })}

          {/* Untyped custom services group */}
          {untypedCustomItems.length > 0 && [
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
              Custom Services
            </ListSubheader>,
            ...untypedCustomItems.map(svc => (
              <MenuItem
                key={svc.url}
                value={svc.url}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Person fontSize="small" color="primary" />
                  <span style={{ flex: 1 }}>{svc.label}</span>
                  {svc.hasAuth && (
                    <Lock fontSize="small" sx={{ opacity: 0.6 }} />
                  )}
                </Box>
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
