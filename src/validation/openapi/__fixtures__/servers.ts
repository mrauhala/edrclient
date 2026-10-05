import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import type { Collection } from '../../../types/api';

// Real API definitions and /collections responses (2026-10-05), gzipped to keep the repo small
export const SERVERS = {
  fmi: { docUrl: 'https://opendata.fmi.fi/edr/api?f=JSON', doc: 'fmi-openapi.json', collections: 'fmi-collections.json' },
  dwd: { docUrl: 'https://nwp.opendata-api.dwd.de/v1beta1/openapi.json', doc: 'dwd-openapi.json', collections: 'dwd-collections.json' },
  meteocore: { docUrl: 'https://meteocore.app.meteo.fi/edr/api', doc: 'meteocore-openapi.json', collections: 'meteocore-collections.json' },
  metoffice: { docUrl: 'https://labs.metoffice.gov.uk/edr/api', doc: 'metoffice-openapi.json', collections: 'metoffice-collections.json' },
  metno: { docUrl: 'https://aviation.met.no/desc', doc: 'metno-openapi.yaml', collections: 'metno-collections.json' },
  meteogate: {
    docUrl: 'https://api.meteogate.eu/eu-eumetnet-surface-observations/openapi.json',
    doc: 'meteogate-openapi.json',
    collections: 'meteogate-collections.json',
  },
} as const;

export type ServerName = keyof typeof SERVERS;

export function fixtureText(file: string): string {
  return gunzipSync(readFileSync(new URL(`./${file}.gz`, import.meta.url))).toString('utf8');
}

export function fixtureCollections(server: ServerName): Collection[] {
  return JSON.parse(fixtureText(SERVERS[server].collections)).collections;
}
