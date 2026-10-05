import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { loadServiceDescription, parseServiceDescription, pickOpenApiLink } from './loadServiceDescription';
import { fixtureText } from './__fixtures__/servers';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
const get = vi.mocked(axios.get);

describe('pickOpenApiLink', () => {
  const desc = (type?: string) => ({ rel: 'service-desc', href: `https://x.org/${type ?? 'untyped'}`, type });

  it('skips AsyncAPI and prefers OpenAPI JSON (Met Office lists both)', () => {
    const links = [desc('application/vnd.aai.asyncapi+yaml;version=2.0.0'), desc('application/vnd.oai.openapi+json;version=3.0')];
    expect(pickOpenApiLink(links)?.type).toBe('application/vnd.oai.openapi+json;version=3.0');
  });

  it('ranks OpenAPI JSON over YAML over plain JSON over untyped', () => {
    expect(pickOpenApiLink([desc(), desc('application/json'), desc('application/openapi+yaml')])?.type).toBe('application/openapi+yaml');
    expect(pickOpenApiLink([desc(), desc('application/json')])?.type).toBe('application/json');
    expect(pickOpenApiLink([desc()])?.href).toBe('https://x.org/untyped');
  });

  it('accepts the OGC rel URI and ignores other links', () => {
    expect(pickOpenApiLink([{ rel: 'http://www.opengis.net/def/rel/ogc/1.0/service-desc', href: 'a', type: 'application/json' }])?.href).toBe('a');
    expect(pickOpenApiLink([{ rel: 'service-doc', href: 'b', type: 'text/html' }])).toBeNull();
    expect(pickOpenApiLink(undefined)).toBeNull();
  });
});

describe('parseServiceDescription', () => {
  it('parses JSON', async () => {
    expect(await parseServiceDescription('{"openapi":"3.1.0"}')).toEqual({ doc: { openapi: '3.1.0' }, format: 'json' });
  });

  it('parses the YAML-only MET Norway document, keeping dates as strings', async () => {
    const { doc, format } = await parseServiceDescription(fixtureText('metno-openapi.yaml'), 'application/openapi+yaml');
    expect(format).toBe('yaml');
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths as object).length).toBeGreaterThan(0);
    const { doc: dated } = await parseServiceDescription('openapi: 3.0.0\nx-date: 2026-10-05\n', 'yaml');
    expect(dated['x-date']).toBe('2026-10-05');
  });

  it('rejects text that is neither', async () => {
    await expect(parseServiceDescription('just text')).rejects.toThrow();
  });
});

describe('loadServiceDescription', () => {
  beforeEach(() => get.mockReset());

  it('fetches once per URL, shares concurrent requests, and reports format and size', async () => {
    get.mockResolvedValue({ data: '{"openapi":"3.0.3","paths":{}}', headers: { 'content-type': 'application/json' } });
    const [a, b] = await Promise.all([loadServiceDescription('https://a.org/api'), loadServiceDescription('https://a.org/api')]);
    expect(a).toBe(b);
    expect(a).toMatchObject({ url: 'https://a.org/api', format: 'json', version: '3.0.3', bytes: 30 });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]).toMatchObject({ responseType: 'text', headers: { Accept: expect.stringContaining('openapi+json') } });
  });

  it('does not cache failures', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    await expect(loadServiceDescription('https://b.org/api')).rejects.toThrow('offline');
    get.mockResolvedValueOnce({ data: '{"openapi":"3.1.0"}', headers: {} });
    await expect(loadServiceDescription('https://b.org/api')).resolves.toMatchObject({ version: '3.1.0' });
  });

  it('adds auth: API key in the URL, bearer token as a header', async () => {
    get.mockResolvedValue({ data: '{}', headers: {} });
    await loadServiceDescription('https://c.org/api', { apiKey: 'k', apiKeyParam: 'key', bearerToken: 't' });
    expect(get.mock.calls[0][0]).toBe('https://c.org/api?key=k');
    expect(get.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer t' } });
  });
});
