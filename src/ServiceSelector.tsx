import React, { useEffect, useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import ListItemIcon from '@mui/material/ListItemIcon';
import CloudQueue from '@mui/icons-material/CloudQueue';
import Person from '@mui/icons-material/Person';
import Lock from '@mui/icons-material/Lock';
import { getCollections, GetCollectionsResult } from './DataRetrievalAPI';
import SchemaInspector from './SchemaInspector';
import SwaggerUIViewer from './SwaggerUIViewer';
import ConformanceViewer from './ConformanceViewer';
import { useService } from './contexts/ServiceContext';

// EDR service options
const edrServices = [
  { label: '[EDR] IMO Climate API', value: 'https://api.vedur.is/weather/rodeo/' },
  { label: '[EDR] FMI Open Data', value: 'https://opendata.fmi.fi/edr' },
  { label: '[EDR] SWIM MET Norway', value: 'https://aviation.met.no' },
  { label: '[EDR] SWIM IBL', value: 'https://swim.iblsoft.com/edr' },
  { label: '[EDR] SWIM SMHI', value: 'https://aviation.smhi.se' },
  { label: '[EDR] Met Office Labs', value: 'https://labs.metoffice.gov.uk/edr' },
  { label: '[EDR] Meteogate Observations', value: 'https://api.meteogate.eu/eu-eumetnet-surface-observations' },
  { label: '[EDR] Meteogate Climate Observations', value: 'https://api.meteogate.eu/eu-eumetnet-climate-observations/v1' },
  { label: '[EDR] Meteogate Weather Radar', value: 'https://api.meteogate.eu/eu-eumetnet-weather-radar' },
  { label: '[EDR] SmartMet Kenya', value: 'https://data-kenya.smartmet.org/edr' },
  { label: '[EDR] SmartMet Ethiopia', value: 'https://data-ethiopia.smartmet.org/edr' },
  { label: '[Records] WMO GDC WIS2 Germany', value: 'https://wis2.dwd.de/gdc/' },
  { label: '[Records] WMO GDC WIS2 Canada', value: 'https://wis2-gdc.weather.gc.ca' },
  { label: '[Records] WMO GDC WIS2 China', value: 'https://gdc.wis.cma.cn' },
  { label: '[STAC] Copernicus Dataspace', value: 'https://stac.dataspace.copernicus.eu/v1/' },
  { label: '[STAC] MET Norway Radar', value: 'https://radar-stacapi.met.no/v1/' },
  { label: '[STAC] Swiss Federal Spatial Data', value: 'https://data.geo.admin.ch/api/stac/v1/' },
  { label: '[Features] MSC GeoMet', value: 'https://api.weather.gc.ca' },
  { label: 'Custom', value: '' }
];

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

  const [apiUrl, setApiUrl] = useState('https://opendata.fmi.fi/edr');
  const [selectedService, setSelectedService] = useState('https://opendata.fmi.fi/edr');
  const [inputUrl, setInputUrl] = useState('https://opendata.fmi.fi/edr');
  const [validationTrigger, setValidationTrigger] = useState(0);

  // Effect to handle external service URL selection (from settings)
  useEffect(() => {
    if (onServiceUrlSelect) {
      setSelectedService(onServiceUrlSelect);
      setInputUrl(onServiceUrlSelect);
      setApiUrl(onServiceUrlSelect);
    }
  }, [onServiceUrlSelect]);

  // Combine system services with custom services
  const allServices = useMemo(() => {
    const customServiceItems = customServices.map(service => ({
      label: service.name,
      value: service.url,
      isCustom: true,
      hasAuth: !!(service.username || service.password || service.apiKey || service.bearerToken)
    }));

    const sortedSystemServices = [...edrServices.filter(s => s.value !== '')].sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    const sortedCustomServices = [...customServiceItems].sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    return [
      ...sortedSystemServices.map(s => ({ ...s, isCustom: false, hasAuth: false })),
      ...sortedCustomServices,
      { label: 'Custom', value: '', isCustom: false, hasAuth: false }
    ];
  }, [customServices]);

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
    const matchingService = allServices.find(service => service.value === newUrl);
    if (matchingService) {
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

  return (
    <Box sx={{ padding: 2, minWidth: 120, borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="edr-service-select-label">EDR Service</InputLabel>
        <Select
          labelId="edr-service-select-label"
          id="edr-service-select"
          value={selectedService}
          label="EDR Service"
          onChange={handleServiceChange}
          renderValue={(value) => {
            const service = allServices.find(s => s.value === value);
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {service?.isCustom ? (
                  <Person fontSize="small" color="primary" />
                ) : (
                  <CloudQueue fontSize="small" color="action" />
                )}
                <span>{service?.label || value}</span>
                {service?.hasAuth && (
                  <Lock fontSize="small" sx={{ ml: 'auto', opacity: 0.6 }} />
                )}
              </Box>
            );
          }}
        >
          {allServices.map((service) => (
            <MenuItem
              key={service.value || 'custom'}
              value={service.value}
              sx={{
                color: service.isCustom ? 'primary.main' : 'text.primary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {service.isCustom ? (
                    <Person fontSize="small" color="primary" />
                  ) : (
                    <CloudQueue fontSize="small" color="action" />
                  )}
                </ListItemIcon>
                {service.label}
              </Box>
              {service.hasAuth && (
                <Lock fontSize="small" sx={{ ml: 1, opacity: 0.6 }} />
              )}
            </MenuItem>
          ))}
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
