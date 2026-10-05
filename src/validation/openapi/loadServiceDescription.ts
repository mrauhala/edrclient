import axios from 'axios';
import type { AuthCredentials, Link } from '../../types/api';
import { getAxiosConfig, addApiKeyToUrl } from '../../api/auth';

// The server's API definition (service-desc), parsed
export interface ServiceDescription {
  url: string;
  doc: Record<string, unknown>;
  format: 'json' | 'yaml';
  bytes: number;
  version: string; // the document's `openapi` field, '' if missing
}

const SERVICE_DESC_RELS = ['service-desc', 'http://www.opengis.net/def/rel/ogc/1.0/service-desc'];

// Rank a service-desc link by media type: OpenAPI JSON first, then YAML, plain JSON, untyped.
// AsyncAPI and other non-OpenAPI descriptions are skipped.
function linkRank(link: Link): number {
  const type = (link.type ?? '').toLowerCase();
  if (type.includes('asyncapi')) return -1;
  if (type.includes('openapi') && type.includes('json')) return 4;
  if (type.includes('openapi')) return 3;
  if (type.includes('json')) return 2;
  if (type.includes('yaml')) return 1;
  return type === '' ? 1 : 0;
}

export function pickOpenApiLink(links: Link[] | undefined): Link | null {
  const candidates = (links ?? []).filter(link => SERVICE_DESC_RELS.includes(link.rel ?? '') && linkRank(link) > 0);
  return candidates.reduce<Link | null>((best, link) => (!best || linkRank(link) > linkRank(best) ? link : best), null);
}

// Parse a fetched description: JSON first, then YAML (CORE_SCHEMA keeps dates as strings)
export async function parseServiceDescription(text: string, hint?: string): Promise<{ doc: Record<string, unknown>; format: 'json' | 'yaml' }> {
  if (!/ya?ml/i.test(hint ?? '')) {
    try {
      return { doc: JSON.parse(text), format: 'json' };
    } catch {
      // not JSON, try YAML below
    }
  }
  const yaml = await import('js-yaml');
  const doc = yaml.load(text, { schema: yaml.CORE_SCHEMA });
  if (!doc || typeof doc !== 'object') throw new Error('The API definition is neither JSON nor YAML');
  return { doc: doc as Record<string, unknown>, format: 'yaml' };
}

const MAX_CACHED = 4;
const cache = new Map<string, Promise<ServiceDescription>>();

async function fetchServiceDescription(url: string, auth?: AuthCredentials): Promise<ServiceDescription> {
  const config = getAxiosConfig(auth);
  const response = await axios.get<string>(addApiKeyToUrl(url, auth), {
    ...config,
    responseType: 'text',
    transformResponse: data => data,
    headers: {
      ...(config.headers ?? {}),
      Accept: 'application/vnd.oai.openapi+json, application/json;q=0.9, application/yaml;q=0.8, */*;q=0.5',
    },
  });
  const text = String(response.data ?? '');
  const { doc, format } = await parseServiceDescription(text, String(response.headers['content-type'] ?? ''));
  return { url, doc, format, bytes: text.length, version: typeof doc.openapi === 'string' ? doc.openapi : '' };
}

// Fetch and parse a service description, cached per URL (documents reach 1 MB). Concurrent
// requests for the same URL share one fetch, so it takes no abort signal: a caller that no longer
// needs the result ignores it, and the document stays cached. A failed fetch isn't cached.
export function loadServiceDescription(url: string, auth?: AuthCredentials): Promise<ServiceDescription> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = fetchServiceDescription(url, auth);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
  return pending;
}
