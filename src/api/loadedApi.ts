import { parseLicense, type LicenseInfo } from '../CollectionInfo';
import { apiRootOf, knownServiceUrl, requestFromHash } from '../query/requestLink';
import type { GetCollectionsResult, Link } from '../types/api';

// What an API says about itself when it's loaded
export interface LoadedApi {
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  links: Link[] | null;
  collectionsLinks: Link[] | null;
  conformsTo: string[] | null;
}

export const NOTHING_LOADED: LoadedApi = {
  title: null,
  description: null,
  keywords: null,
  links: null,
  collectionsLinks: null,
  conformsTo: null,
};

export function loadedApiOf(result: GetCollectionsResult): LoadedApi {
  return {
    title: result.landingPageTitle || null,
    description: result.landingPageDescription || null,
    keywords: result.landingPageKeywords || null,
    links: result.landingPageLinks || null,
    collectionsLinks: result.collectionsLinks || null,
    conformsTo: result.conformsTo || null,
  };
}

// The licence a collection falls back on: what the list of collections links to, or else the landing page
export function licenseOf({ collectionsLinks, links }: Pick<LoadedApi, 'collectionsLinks' | 'links'>): LicenseInfo | null {
  for (const candidates of [collectionsLinks, links]) {
    const link = candidates?.find(candidate => candidate.rel === 'license');
    if (link) return parseLicense(link.href, link.title);
  }
  return null;
}

// The API a request belongs to, by the name it's listed under if it is
export function apiOfRequest(requestUrl: string, serviceUrls: string[]): string {
  const root = apiRootOf(requestUrl);
  return knownServiceUrl(root, serviceUrls) ?? root;
}

// A link in the address opens on its request's API
export function startingApiUrl(hash: string, serviceUrls: string[], defaultUrl: string): string {
  const link = requestFromHash(hash);
  return link ? apiOfRequest(link, serviceUrls) : defaultUrl;
}
