import type { Collection } from '../types/api';

// Validate that a URL uses a safe protocol (http/https or relative)
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  // Relative URLs are safe
  if (trimmed.startsWith('/') || trimmed.startsWith('.') || !trimmed.includes(':')) {
    return true;
  }
  // Only allow http and https protocols
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // If URL parsing fails, it's likely a relative URL
    return true;
  }
}

// Resolve a (possibly relative) href against a base URL.
// Returns an absolute URL string, or the original href if no base is provided.
export function resolveHref(href: string, baseUrl?: string): string {
  if (!baseUrl) return href;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

// Helper function to normalize href which can be a string or an object with language codes
// Returns the first available string value, or null if href is invalid or uses an unsafe protocol
// When baseUrl is provided, relative hrefs are resolved against it.
export function normalizeHref(href: string | { [lang: string]: string } | undefined, baseUrl?: string): string | null {
  if (!href) {
    return null;
  }

  if (typeof href === 'string') {
    if (!isSafeUrl(href)) return null;
    return baseUrl ? resolveHref(href, baseUrl) : href;
  }

  // If href is an object (e.g., {en: "...", fr: "..."}), return the first available value
  if (typeof href === 'object') {
    // Try common language codes first
    const preferredLangs = ['en', 'en-US', 'en-CA', 'fr', 'de', 'es'];
    for (const lang of preferredLangs) {
      if (href[lang] && isSafeUrl(href[lang])) {
        return baseUrl ? resolveHref(href[lang], baseUrl) : href[lang];
      }
    }

    // If no preferred language found, return the first available safe value
    const values = Object.values(href);
    if (values.length > 0 && typeof values[0] === 'string' && isSafeUrl(values[0])) {
      return baseUrl ? resolveHref(values[0], baseUrl) : values[0];
    }
  }

  return null;
}

// Some servers build a collection's hrefs by appending its id and path to the request URL, query
// string and all: DMI answers `collections?f=json` with `collections?f=json/dkss_nsbs/position`,
// which would request the collections list. Moves the appended path in front of the query.
export function repairAppendedHref(href: string, requestUrl: string, id: string): string {
  const queryStart = requestUrl.indexOf('?');
  if (queryStart < 0 || !href.startsWith(`${requestUrl}/`)) return href;
  const appended = href.slice(requestUrl.length);
  // Anchored on the id: a query value can itself continue with a slash (a datetime interval)
  const firstSegment = appended.split('/')[1];
  if (firstSegment !== id && firstSegment !== encodeURIComponent(id)) return href;
  return requestUrl.slice(0, queryStart) + appended;
}

// Resolve a collection's (or an instance's) relative link and data query hrefs, in place. With the
// URL the collection was fetched from, hrefs appended to it are repaired too; returns how many were.
export function resolveCollectionHrefs(collection: Collection, baseUrl: string, requestUrl?: string): number {
  let repaired = 0;
  const resolve = (href: string) => {
    const resolved = resolveHref(href, baseUrl);
    const fixed = requestUrl ? repairAppendedHref(resolved, requestUrl, String(collection.id)) : resolved;
    if (fixed !== resolved) repaired++;
    return fixed;
  };
  for (const link of Array.isArray(collection.links) ? collection.links : []) {
    if (typeof link.href === 'string') link.href = resolve(link.href);
  }
  for (const query of Object.values(collection.data_queries ?? {})) {
    if (query?.link && typeof query.link.href === 'string') query.link.href = resolve(query.link.href);
  }
  return repaired;
}
