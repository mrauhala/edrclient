import { capturedGet, type CapturedResponse } from '../../api/capture';
import type { AuthCredentials, Link } from '../../types/api';

// The server's API definition (service-desc), parsed
export interface ServiceDescription {
  url: string;
  doc: Record<string, unknown>;
  format: 'json' | 'yaml';
  bytes: number;
  version: string; // the document's `openapi` field, '' if missing
  // What its request got back, as it came
  captured: CapturedResponse;
}

const SERVICE_DESC_RELS = ['service-desc', 'http://www.opengis.net/def/rel/ogc/1.0/service-desc'];

// An untyped link's href hints at what it is. Meteogate's climate observations list two untyped
// service-desc links, the Swagger UI page /docs first and /openapi.json second.
function untypedRank(href: unknown): number {
  const path = (typeof href === 'string' ? href : '').split(/[?#]/)[0].toLowerCase();
  if (/\.(json|ya?ml)$|openapi/.test(path)) return 1;
  if (/\.html?$|\/docs\/?$|swagger-ui|redoc/.test(path)) return 0.5;
  return 0.75;
}

// Rank a service-desc link by media type: OpenAPI JSON first, then YAML, plain JSON, untyped.
// AsyncAPI and other non-OpenAPI descriptions are skipped.
function linkRank(link: Link): number {
  const type = (link.type ?? '').toLowerCase();
  if (type.includes('asyncapi')) return -1;
  if (type.includes('openapi') && type.includes('json')) return 4;
  if (type.includes('openapi')) return 3;
  if (type.includes('json')) return 2;
  if (type.includes('yaml')) return 1;
  return type === '' ? untypedRank(link.href) : 0;
}

// A service-desc link that answers with a web page (a Swagger UI or ReDoc page) instead of a document
export class WebPageError extends Error {}

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
  const asked: { capture: CapturedResponse | null } = { capture: null };
  try {
    const response = await capturedGet<string>(url, auth, undefined, capture => { asked.capture = capture; }, {
      responseType: 'text',
      transformResponse: data => data,
      headers: { Accept: 'application/vnd.oai.openapi+json, application/json;q=0.9, application/yaml;q=0.8, */*;q=0.5' },
    });
    const text = String(response.data ?? '');
    const contentType = String(response.headers['content-type'] ?? '');
    if (/text\/html/i.test(contentType) || /^\s*<(!doctype html|html)/i.test(text)) {
      throw new WebPageError(`${url} is a web page, not an OpenAPI document`);
    }
    const { doc, format } = await parseServiceDescription(text, contentType);
    return { url, doc, format, bytes: text.length, version: typeof doc.openapi === 'string' ? doc.openapi : '', captured: asked.capture! };
  } catch (error) {
    // Whatever came back is still worth showing, also when it isn't a document. Not enumerable, so that it stays out of logs
    throw Object.defineProperty(error as object, 'captured', { value: asked.capture });
  }
}

// What came back for a description that couldn't be loaded
export const capturedOfFailure = (error: unknown): CapturedResponse | null => (error as { captured?: CapturedResponse | null } | null)?.captured ?? null;

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

// So that the next load asks again: the document may have changed
export function forgetServiceDescription(url: string): void {
  cache.delete(url);
}

