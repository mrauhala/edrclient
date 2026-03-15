export enum ServiceType {
  EDR = 'EDR',
  Features = 'Features',
  Records = 'Records',
  STAC = 'STAC',
  Maps = 'Maps',
  Tiles = 'Tiles',
  Processes = 'Processes',
}

export interface ServiceDefinition {
  label: string;
  url: string;
  type: ServiceType;
}
