import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import axios from 'axios';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getCollections } from './client';
import meteogate from './__fixtures__/meteogate-climate.json';

const MG = 'https://api.meteogate.eu/eu-eumetnet-climate-observations/v1';
type Responses = Record<string, unknown>;

// Serve the given responses by URL; anything else is a 404
const serve = (responses: Responses) => vi.spyOn(axios, 'get').mockImplementation(async (url: string) => {
  if (!(url in responses)) throw Object.assign(new Error(`Request failed with status code 404: ${url}`), { response: { status: 404 } });
  return { data: responses[url], status: 200, headers: {}, request: { responseURL: url } };
});

// Schemas come from the app's public directory
beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(join('public', url), 'utf8')));
});
afterAll(() => vi.unstubAllGlobals());
afterEach(() => vi.restoreAllMocks());

const titles = (errors: { title?: string; severity?: string }[] | null | undefined) =>
  (errors ?? []).map(error => `${error.severity ?? 'error'}: ${error.title}`);

describe('getCollections', () => {
  it('uses a conformance link misfiled as data, and the collections from /collections (Meteogate)', async () => {
    const get = serve(meteogate as Responses);
    const result = await getCollections(MG);

    expect(result.collections.map(collection => collection.id)).toEqual(['nl-daily']);
    // The conformance declaration is fetched once, as conformance, not tried as a collections list
    expect(get.mock.calls.map(([url]) => url)).toEqual([`${MG}?f=json`, `${MG}/conformance?f=json`, `${MG}/collections?f=json`]);

    const problems = titles(result.validation.errors);
    expect(problems).toContain('warning: Conformance Linked as Data');
    expect(problems).not.toContain('error: Conformance Link Missing');
    expect(problems).not.toContain('warning: Multiple Data Links');
    expect(result.validation.errors?.find(error => error.title === 'Conformance Linked as Data')?.message)
      .toBe(`The landing page links its conformance declaration (${MG}/conformance) as rel="data" and has no rel="conformance" link. It was used as the conformance link.`);
    expect(result.validation.conformanceValidation?.isValid).toBe(true);
  });

  it('moves on from a data link that answers without a collections list', async () => {
    const landing = { links: [{ rel: 'data', href: `${MG}/other` }, { rel: 'data', href: `${MG}/collections` }] };
    serve({ [`${MG}?f=json`]: landing, [`${MG}/other?f=json`]: { hello: 'world' }, [`${MG}/collections?f=json`]: meteogate[`${MG}/collections?f=json`] });
    const result = await getCollections(MG);

    expect(result.collections.map(collection => collection.id)).toEqual(['nl-daily']);
    const multiple = result.validation.errors?.find(error => error.title === 'Multiple Data Links');
    expect(multiple?.severity).toBe('warning');
    expect(multiple?.message).toContain(`The collections came from ${MG}/collections.`);
  });

  it('says so when no data link gives a collections list', async () => {
    serve({ [`${MG}?f=json`]: { links: [{ rel: 'data', href: `${MG}/other` }] }, [`${MG}/other?f=json`]: { hello: 'world' } });
    const result = await getCollections(MG);

    expect(result.collections).toEqual([]);
    expect(result.validation.errors?.find(error => error.title === 'No Collections List')?.message)
      .toBe(`${MG}/other answered without a "collections" array, so no collections can be listed.`);
  });
});

describe('getCollections when a request fails', () => {
  const LANDING = `${MG}?f=json`;
  const COLLECTIONS = `${MG}/collections?f=json`;

  // The landing page answers unless it is the URL that fails; the failing URL throws like axios does
  const failAt = (failingUrl: string, error: Error) => vi.spyOn(axios, 'get').mockImplementation(async (url: string) => {
    if (url === failingUrl) throw Object.assign(error, { config: { url } });
    if (url === LANDING) return { data: { links: [{ rel: 'data', href: `${MG}/collections` }] }, status: 200, headers: {}, request: { responseURL: url } };
    throw new Error(`unexpected request: ${url}`);
  });
  const fatal = async () => (await getCollections(MG)).validation.errors?.[0];

  it.each([
    [LANDING, new Error('Network Error'), 'Connection Failed', 'network',
      `Unable to connect to landing page. This may be due to CORS restrictions or the service being unavailable. URL: ${LANDING}`],
    [COLLECTIONS, new Error('Network Error'), 'Collections Unreachable', 'network',
      `Unable to connect to collections endpoint. This may be due to CORS restrictions or the service being unavailable. URL: ${COLLECTIONS}`],
    [COLLECTIONS, new Error('Blocked by CORS policy'), 'Collections CORS Error', 'cors',
      `collections endpoint does not allow cross-origin requests from web browsers. URL: ${COLLECTIONS}`],
    [COLLECTIONS, new Error('Request failed with status code 404'), 'Collections Not Found', 'network',
      `collections endpoint returned 404. URL: ${COLLECTIONS}`],
    [LANDING, new Error('Request failed with status code 401'), 'Authentication Error', 'network',
      `landing page requires authentication or returned access denied. URL: ${LANDING}`],
    [LANDING, new Error('socket hang up'), 'Error', 'unknown',
      `Failed to fetch landing page: socket hang up. URL: ${LANDING}`],
  ])('%s: %s → %s', async (url, error, title, type, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failAt(url, error);
    expect(await fatal()).toMatchObject({ title, type, message });
  });

  it('treats an unclassified ERR_NETWORK as unreachable, without assuming CORS', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failAt(LANDING, Object.assign(new Error('xhr failed'), { code: 'ERR_NETWORK' }));
    expect(await fatal()).toMatchObject({
      title: 'Connection Failed',
      type: 'network',
      message: `Unable to connect to landing page. The service may be unreachable or blocking cross-origin requests. URL: ${LANDING}`,
    });
  });
});
