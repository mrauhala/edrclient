import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { capturedOfFailure, forgetServiceDescription, loadServiceDescription, parseServiceDescription, pickOpenApiLink, WebPageError } from './loadServiceDescription';
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

  it('picks the document over a web page among untyped links (Meteogate)', () => {
    const mg = 'https://api.meteogate.eu/eu-eumetnet-climate-observations/v1';
    const untyped = (href: string) => ({ rel: 'service-desc', href });
    expect(pickOpenApiLink([untyped(`${mg}/docs`), untyped(`${mg}/openapi.json`)])?.href).toBe(`${mg}/openapi.json`);
    expect(pickOpenApiLink([untyped('https://x.org/api.html'), untyped('https://x.org/api')])?.href).toBe('https://x.org/api');
    expect(pickOpenApiLink([untyped('https://x.org/swagger-ui/'), untyped('https://x.org/spec.yaml?f=yaml')])?.href).toBe('https://x.org/spec.yaml?f=yaml');
    // A typed link still wins, and a web page is used when it is all there is
    expect(pickOpenApiLink([untyped('https://x.org/openapi.json'), desc('application/json')])?.type).toBe('application/json');
    expect(pickOpenApiLink([untyped(`${mg}/docs`)])?.href).toBe(`${mg}/docs`);
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

  it('rejects a web page with a message saying so, not parser output (Meteogate /docs)', async () => {
    get.mockResolvedValueOnce({ data: '<!DOCTYPE html>\n<html><head><title>Swagger UI</title></head></html>', headers: { 'content-type': 'text/html; charset=utf-8' } });
    const loading = loadServiceDescription('https://d.org/docs');
    await expect(loading).rejects.toThrow(new WebPageError('https://d.org/docs is a web page, not an OpenAPI document'));
    await expect(loading).rejects.toBeInstanceOf(WebPageError);
    // Also without a content type
    get.mockResolvedValueOnce({ data: '  <html><body>docs</body></html>', headers: {} });
    await expect(loadServiceDescription('https://d.org/docs2')).rejects.toBeInstanceOf(WebPageError);
  });

  it('adds auth: API key in the URL, bearer token as a header', async () => {
    get.mockResolvedValue({ data: '{}', headers: {} });
    await loadServiceDescription('https://c.org/api', { apiKey: 'k', apiKeyParam: 'key', bearerToken: 't' });
    expect(get.mock.calls[0][0]).toBe('https://c.org/api?key=k');
    expect(get.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer t' } });
  });
});

describe('what a service description keeps of its request', () => {
  beforeEach(() => get.mockReset());

  it('keeps the text as it came, with its status and size', async () => {
    const text = '{ "openapi":   "3.0.3", "paths": {} }';
    get.mockResolvedValueOnce({ data: text, status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, request: { responseText: text } });
    const { captured } = await loadServiceDescription('https://capture.example/api');
    expect(captured.text).toBe(text);
    expect(captured.url).toBe('https://capture.example/api');
    expect(captured.response?.status).toBe(200);
    expect(captured.response?.sizeBytes).toBe(text.length);
    expect(captured.response?.contentType).toBe('application/json');
  });

  it('keeps what came back when it was an error', async () => {
    const answer = { data: 'Nope', status: 500, statusText: 'Oops', headers: {}, request: { responseText: 'Nope' } };
    get.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 500'), { response: answer }));
    const failure = await loadServiceDescription('https://capture.example/broken').catch((error: unknown) => error);
    expect(capturedOfFailure(failure)?.response?.status).toBe(500);
    expect(capturedOfFailure(failure)?.text).toBe('Nope');
  });

  it('keeps what came back when it was a web page, and it stays out of logs', async () => {
    const page = '<!doctype html><html></html>';
    get.mockResolvedValueOnce({ data: page, status: 200, statusText: 'OK', headers: { 'content-type': 'text/html' }, request: { responseText: page } });
    const failure = await loadServiceDescription('https://capture.example/page').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WebPageError);
    expect(capturedOfFailure(failure)?.text).toBe(page);
    expect(Object.keys(failure as object)).not.toContain('captured');
  });

  it('says when no response came', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
    const failure = await loadServiceDescription('https://capture.example/gone').catch((error: unknown) => error);
    expect(capturedOfFailure(failure)?.response).toBeNull();
    expect(capturedOfFailure(failure)?.failure).toMatch(/^Network error/);
  });

  it('has nothing for an error that is not from it', () => {
    expect(capturedOfFailure(new Error('x'))).toBeNull();
    expect(capturedOfFailure(null)).toBeNull();
  });

  it('asks again once it is forgotten, and not before', async () => {
    const text = '{"openapi":"3.0.3","paths":{}}';
    get.mockResolvedValue({ data: text, status: 200, statusText: 'OK', headers: {}, request: { responseText: text } });
    const url = 'https://capture.example/again';
    await loadServiceDescription(url);
    await loadServiceDescription(url);
    expect(get).toHaveBeenCalledTimes(1);
    forgetServiceDescription(url);
    await loadServiceDescription(url);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

