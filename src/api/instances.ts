import axios from 'axios';
import type { AuthCredentials } from '../types/api';
import { getAxiosConfig, addApiKeyToUrl } from './auth';
import { resolveCollectionHrefs } from '../utils/href';
import { sortInstancesNewestFirst, type Instance } from '../query/instances';

const MAX_CACHED = 4;
const cache = new Map<string, Promise<Instance[]>>();

async function fetchInstanceList(url: string, auth?: AuthCredentials): Promise<Instance[]> {
  const response = await axios.get(addApiKeyToUrl(url, auth), getAxiosConfig(auth));
  const instances: Instance[] = Array.isArray(response.data?.instances) ? response.data.instances : [];
  // Relative hrefs resolve against the URL the list came from (after redirects, e.g. Met Office's /instances/)
  const base = (response.request as XMLHttpRequest | undefined)?.responseURL || url;
  instances.forEach(instance => resolveCollectionHrefs(instance, base));
  return sortInstancesNewestFirst(instances);
}

// A collection's instances, latest first. Cached per URL: lists reach megabytes (MeteoCore's
// dwd-icon-eu: 953 runs, 7.7 MB), and servers ignore limit. A failed fetch isn't cached.
export function fetchInstances(url: string, auth?: AuthCredentials): Promise<Instance[]> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = fetchInstanceList(url, auth);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
  return pending;
}
