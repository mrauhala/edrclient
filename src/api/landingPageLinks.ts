import type { Link } from '../types/api';
import { normalizeHref } from '../utils/href';

const DATA_RELS = ['data', 'http://www.opengis.net/def/rel/ogc/1.0/data'];

// The collections URLs a landing page links as data, resolved and without repeats. EDR names the
// relation `data`, OGC API - Common the URI form, so a server declaring both links the same href
// twice (MeteoCore): that's one URL, not two.
export function dataLinkUrls(links: Link[], baseUrl: string): string[] {
  const urls = links
    .filter(link => DATA_RELS.includes(link.rel ?? ''))
    .map(link => normalizeHref(link.href, baseUrl))
    .filter((url): url is string => !!url);
  return [...new Set(urls)];
}

const lastPathSegment = (url: string): string => {
  try {
    return new URL(url).pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  } catch {
    return '';
  }
};

// Sort a landing page's data URLs into collections candidates, `/collections` first, and a
// conformance declaration linked as data. Meteogate's climate observations link /conformance as
// rel="data", ahead of /collections, and have no rel="conformance" link.
export function classifyDataLinks(urls: string[]): { collections: string[]; conformance: string | null } {
  const conformance = urls.find(url => lastPathSegment(url) === 'conformance') ?? null;
  const others = urls.filter(url => url !== conformance);
  const isCollections = (url: string) => lastPathSegment(url) === 'collections';
  return { collections: [...others.filter(isCollections), ...others.filter(url => !isCollections(url))], conformance };
}

// Whether a response is a collections list: a `collections` array, or a bare array of collections
export function hasCollectionsList(data: unknown): boolean {
  return Array.isArray(data) || Array.isArray((data as { collections?: unknown } | null)?.collections);
}
