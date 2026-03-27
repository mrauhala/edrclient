import axios from 'axios';
import type { Collection, AuthCredentials } from '../types/api';
import { normalizeHref } from '../utils/href';
import { getAxiosConfig, addApiKeyToUrl } from './auth';

export interface QueryableProperty {
  name: string;
  title?: string;
  type: string;       // "string" | "number" | "integer" | "boolean"
  enum?: string[];
  format?: string;    // e.g. "date-time"
}

export interface QueryablesSchema {
  properties: QueryableProperty[];
}

// Module-level cache: Map<url, { data, timestamp }>
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RESPONSE_BYTES = 1_000_000; // 1MB
const MAX_PROPERTIES = 100;

interface CacheEntry {
  data: QueryablesSchema;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

const QUERYABLES_RELS = [
  'http://www.opengis.net/def/rel/ogc/0.0/queryables',
  'http://www.opengis.net/def/rel/ogc/1.0/queryables',
  'queryables',
];

/**
 * Check whether a collection advertises a queryables link.
 */
export function hasQueryablesLink(collection: Collection): boolean {
  return getQueryablesUrl(collection) !== null;
}

/**
 * Get the queryables URL from a collection's links.
 * Only returns a URL if the collection has an explicit queryables rel link.
 */
export function getQueryablesUrl(collection: Collection): string | null {
  if (!collection.links) return null;

  const queryablesLink = collection.links.find(
    (l) => l.rel != null && QUERYABLES_RELS.includes(l.rel)
  );

  return queryablesLink ? normalizeHref(queryablesLink.href) : null;
}

/**
 * Fetch and parse queryables schema for a collection.
 * Returns null on 404 or any error.
 */
export async function fetchQueryables(
  collection: Collection,
  auth?: AuthCredentials,
  signal?: AbortSignal
): Promise<QueryablesSchema | null> {
  const url = getQueryablesUrl(collection);
  if (!url) return null;

  // Check cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const fetchUrl = addApiKeyToUrl(url, auth);
    const response = await axios.get(fetchUrl, {
      ...getAxiosConfig(auth, signal),
      maxContentLength: MAX_RESPONSE_BYTES,
      maxBodyLength: MAX_RESPONSE_BYTES,
    });

    const data = response.data;

    // Validate: must have type="object" and properties
    if (!data || data.type !== 'object' || !data.properties || typeof data.properties !== 'object') {
      return null;
    }

    // Extract metadata only: name, type, title, enum, format
    const properties: QueryableProperty[] = [];
    const entries = Object.entries(data.properties);

    for (const [key, value] of entries) {
      if (properties.length >= MAX_PROPERTIES) break;

      const prop = value as Record<string, unknown>;

      // Skip properties with $ref
      if (prop.$ref) continue;

      // Only include properties with a known type
      const type = prop.type;
      if (typeof type !== 'string') continue;

      const qp: QueryableProperty = { name: key, type };

      if (typeof prop.title === 'string') qp.title = prop.title;
      if (typeof prop.format === 'string') qp.format = prop.format;
      if (Array.isArray(prop.enum)) qp.enum = prop.enum.map(String);

      properties.push(qp);
    }

    const schema: QueryablesSchema = { properties };

    // Cache on success
    cache.set(url, { data: schema, timestamp: Date.now() });

    return schema;
  } catch {
    // 404 or network error — return null silently
    return null;
  }
}

export function clearQueryablesCache(): void {
  cache.clear();
}

