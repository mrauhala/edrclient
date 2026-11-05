import { addApiKeyToUrl } from '../api/auth';
import type { AuthCredentials } from '../types/api';
import { encodedUrl, isSendableUrl } from './requestUrl';

// Links that reopen a request: the app's own address with the request in the fragment. A fragment
// never reaches the host serving the app, which suits private API URLs, and it has no length limit
// to speak of for long polygons.

export function requestLink(url: string, pageUrl: string): string {
  return `${pageUrl.split('#')[0]}#request=${encodeURIComponent(url)}`;
}

// The request in a link's fragment, with its spaces back as spaces; null unless it's one we'd send
export function requestFromHash(hash: string): string | null {
  const url = new URLSearchParams(hash.replace(/^#/, '')).get('request');
  return url && isSendableUrl(url) ? url.replace(/%20/g, ' ') : null;
}

const pathOf = (url: string) => decodeURIComponent(new URL(url).pathname);

function parsedPath(url: string): RegExpExecArray | null {
  try {
    return /^(.*?)\/collections\/([^/]+)(\/.*)?$/.exec(pathOf(url));
  } catch {
    return null;
  }
}

// The API a request belongs to: all that comes before /collections, /conformance or /api
export function apiRootOf(url: string): string {
  const { origin, pathname } = new URL(url);
  return `${origin}${pathname.replace(/\/(collections|conformance|api)(\/.*)?$/, '').replace(/\/+$/, '')}`;
}

export const collectionIdOf = (url: string): string | null => parsedPath(url)?.[2] ?? null;

// Whether a URL goes no further than its collection, so there's no query for the form to follow
export function isJustCollection(url: string): boolean {
  const path = parsedPath(url);
  return !!path && (!path[3] || path[3] === '/');
}

// What it takes to get to a request not for the open collection: open another collection, load another
// API first, or nothing, for a URL with no collection in it, which may not be an OGC API at all
export function requestRoute(url: string, apiUrl: string | null): 'collection' | 'api' | 'none' {
  if (collectionIdOf(url) === null) return 'none';
  return apiRootOf(url) === apiUrl?.replace(/\/+$/, '') ? 'collection' : 'api';
}

// The entry of a list of services that is this API, whether or not they end in a slash
export function knownServiceUrl(root: string, serviceUrls: string[]): string | undefined {
  return serviceUrls.find(url => url.replace(/\/+$/, '') === root);
}

const shellQuoted = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`;

// The request as a command to run elsewhere. Stored credentials never go in it, only where they'd go.
export function curlCommand(url: string, auth?: AuthCredentials): string {
  const target = auth?.apiKey
    ? addApiKeyToUrl(encodedUrl(url), { apiKey: 'YOUR_API_KEY', apiKeyParam: auth.apiKeyParam })
    : encodedUrl(url);
  const credentials = auth?.customAuthHeader ? ` -H ${shellQuoted('Authorization: YOUR_AUTHORIZATION')}`
    : auth?.bearerToken ? ` -H ${shellQuoted('Authorization: Bearer YOUR_TOKEN')}`
      : auth?.username ? ` -u ${shellQuoted('YOUR_USERNAME:YOUR_PASSWORD')}`
        : '';
  return `curl -i${credentials} ${shellQuoted(target)}`;
}
