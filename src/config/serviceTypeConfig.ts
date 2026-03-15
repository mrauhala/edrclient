import { ServiceType } from '../types/ServiceType';

export interface ServiceTypeDisplay {
  color: string;
  abbreviation: string;
}

export const SERVICE_TYPE_CONFIG: Record<ServiceType, ServiceTypeDisplay> = {
  [ServiceType.EDR]: { color: '#00897b', abbreviation: 'EDR' },
  [ServiceType.Features]: { color: '#1565c0', abbreviation: 'FEA' },
  [ServiceType.Records]: { color: '#6a1b9a', abbreviation: 'REC' },
  [ServiceType.STAC]: { color: '#e65100', abbreviation: 'STAC' },
  [ServiceType.Maps]: { color: '#2e7d32', abbreviation: 'MAP' },
  [ServiceType.Tiles]: { color: '#4527a0', abbreviation: 'TIL' },
  [ServiceType.Processes]: { color: '#c62828', abbreviation: 'PRC' },
};

export const SERVICE_TYPE_ORDER: ServiceType[] = [
  ServiceType.EDR,
  ServiceType.Features,
  ServiceType.Records,
  ServiceType.STAC,
  ServiceType.Maps,
  ServiceType.Tiles,
  ServiceType.Processes,
];
