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
