import { describe, expect, it } from 'vitest';
import type { CapturedResponse } from '../api/capture';
import type { ApiResourceInputs } from './apiResources';
import { apiResources, resourcePath } from './apiResources';
import { formatBytes, formatDuration } from '../utils/formatResponse';
import { problemCount } from '../validation/severity';

const API = 'https://a.example/edr';

const answer = (path: string, status = 200, timeMs = 76, sizeBytes = 1126): CapturedResponse => ({
  url: `${API}${path}?f=json`,
  response: { status, statusText: '', timeMs, sizeBytes, headers: [], contentType: 'application/json', requestUrlBytes: 10, timing: null },
  text: '{}',
  failure: null,
});
const noAnswer = (path: string): CapturedResponse => ({ url: `${API}${path}`, response: null, text: null, failure: 'Network error.' });

const doc = (paths: number) => Object.fromEntries(Array.from({ length: paths }, (_, i) => [`/p${i}`, {}]));

const inputs = (over: Partial<ApiResourceInputs> = {}): ApiResourceInputs => ({
  apiUrl: API,
  loading: false,
  captured: { landingPage: answer(''), conformance: answer('/conformance', 200, 85), collections: answer('/collections', 200, 310) },
  conformsTo: ['a', 'b'],
  collectionCount: 66,
  openApi: { status: 'none', url: null, description: null, captured: null },
  validation: { isValid: true, errors: null },
  ...over,
});
const readyOpenApi = (paths = 473): ApiResourceInputs['openApi'] => ({
  status: 'ready',
  url: `${API}/api`,
  description: { url: `${API}/api`, doc: { paths: doc(paths) }, format: 'json', bytes: 1, version: '3', captured: answer('/api', 200, 980, 792_000) },
  captured: answer('/api', 200, 980, 792_000),
});
const pick = (over: Partial<ApiResourceInputs>, key: string) => apiResources(inputs(over)).find(resource => resource.key === key)!;

describe('resourcePath', () => {
  it('says where it is under the API, without the query', () => {
    expect(resourcePath(`${API}/collections?f=json`, API)).toBe('/collections');
    expect(resourcePath(`${API}?f=json`, API)).toBe('/');
    expect(resourcePath(`${API}/`, API)).toBe('/');
  });

  it('copes with an API given with a slash, or at the root', () => {
    expect(resourcePath(`${API}/api`, `${API}/`)).toBe('/api');
    expect(resourcePath('https://a.example/api', 'https://a.example')).toBe('/api');
    expect(resourcePath('https://a.example/', 'https://a.example')).toBe('/');
  });

  it('gives the whole path for one elsewhere on the same host', () => {
    expect(resourcePath('https://a.example/docs/openapi.json', API)).toBe('/docs/openapi.json');
  });

  it('does not take a neighbour for something under the API', () => {
    expect(resourcePath('https://a.example/edr2/api', API)).toBe('/edr2/api');
  });

  it('names the host for one elsewhere', () => {
    expect(resourcePath('https://b.example/api', API)).toBe('b.example/api');
  });

  it('passes on what it cannot read', () => {
    expect(resourcePath('not a url', API)).toBe('not a url');
  });
});

describe('apiResources', () => {
  it('lists the four, in the order they are in the sketch', () => {
    expect(apiResources(inputs()).map(resource => resource.name)).toEqual(['Landing page', 'Conformance', 'OpenAPI', 'Collections']);
  });

  describe('the figures', () => {
    it('gives a landing page its time and size', () => {
      expect(pick({}, 'landingPage')).toMatchObject({ path: '/', status: 200, facts: ['76 ms', '1.1 KB'], note: null });
    });

    it('gives conformance its time and classes', () => {
      expect(pick({}, 'conformance')).toMatchObject({ path: '/conformance', status: 200, facts: ['85 ms', '2 classes'] });
      expect(pick({ conformsTo: ['a'] }, 'conformance').facts).toEqual(['85 ms', '1 class']);
    });

    it('gives the list its time and count', () => {
      expect(pick({}, 'collections')).toMatchObject({ path: '/collections', status: 200, facts: ['310 ms', '66'] });
    });

    it('gives OpenAPI its time, size and paths', () => {
      const openApi = pick({ openApi: readyOpenApi(), validation: { isValid: true, errors: null, openApiValidation: { isValid: true, errors: null } } }, 'openApi');
      expect(openApi).toMatchObject({ path: '/api', status: 200, facts: [formatDuration(980), formatBytes(792_000), '473 paths'], note: null });
      expect(pick({ openApi: readyOpenApi(1), validation: { isValid: true, errors: null, openApiValidation: { isValid: true, errors: null } } }, 'openApi').facts[2]).toBe('1 path');
    });

    it('counts no paths in a document without any', () => {
      const openApi = { ...readyOpenApi(), description: { ...readyOpenApi().description!, doc: {} } };
      expect(pick({ openApi, collectionCount: 0 }, 'openApi').facts).toContain('0 paths');
    });
  });

  describe('while loading', () => {
    it('says so, with nothing to open', () => {
      for (const resource of apiResources(inputs({ loading: true, captured: {}, conformsTo: null, collectionCount: 0 }))) {
        expect(resource.note).toBe('loading');
        expect(resource.captured).toBeNull();
        expect(resource.status).toBeNull();
        expect(resource.issues).toBeNull();
      }
    });

    it('says OpenAPI is loading until it has come', () => {
      expect(pick({ openApi: { status: 'loading', url: `${API}/api`, description: null, captured: null } }, 'openApi')).toMatchObject({ note: 'loading', path: '/api', captured: null });
    });
  });

  describe('checking OpenAPI', () => {
    it('says it is checking until it has reported', () => {
      expect(pick({ openApi: readyOpenApi() }, 'openApi')).toMatchObject({ note: 'checking', issues: null });
    });

    it('ends when it has reported', () => {
      const done = pick({ openApi: readyOpenApi(), validation: { isValid: true, errors: null, openApiValidation: { isValid: true, errors: null } } }, 'openApi');
      expect(done.note).toBeNull();
      expect(done.issues).toBe(0);
    });

    it('ends with no collections, for which the check never comes', () => {
      expect(pick({ openApi: readyOpenApi(), collectionCount: 0 }, 'openApi').note).toBeNull();
    });
  });

  describe('what can go wrong', () => {
    it('shows an error status, with no figures from a body that is not what it should be', () => {
      expect(pick({ captured: { landingPage: answer(''), conformance: answer('/conformance', 500), collections: answer('/collections') } }, 'conformance')).toMatchObject({ status: 500, facts: ['76 ms'] });
      expect(pick({ captured: { landingPage: answer(''), collections: answer('/collections', 404, 40) } }, 'collections').facts).toEqual(['40 ms']);
    });

    it('says when no response came, and it can still be opened', () => {
      const resource = pick({ captured: { landingPage: noAnswer('') } }, 'landingPage');
      expect(resource).toMatchObject({ status: null, facts: [], note: 'no response' });
      expect(resource.captured?.failure).toBe('Network error.');
    });

    it('says what was not asked for, with nothing to open', () => {
      const resource = pick({ captured: { landingPage: answer('', 404) } }, 'collections');
      expect(resource).toMatchObject({ note: 'not requested', captured: null, path: null, issues: null });
    });

    it('says an API links no OpenAPI document', () => {
      expect(pick({}, 'openApi')).toMatchObject({ note: 'not linked', captured: null, path: null });
    });

    it('does not say so when there was no landing page to tell', () => {
      expect(pick({ captured: { landingPage: answer('', 404) } }, 'openApi').note).toBe('not requested');
      expect(pick({ captured: { landingPage: noAnswer('') } }, 'openApi').note).toBe('not requested');
    });

    it('says a 200 was not a document, and it can be opened', () => {
      const resource = pick({ openApi: { status: 'error', url: `${API}/docs`, description: null, captured: answer('/docs') } }, 'openApi');
      expect(resource).toMatchObject({ status: 200, note: 'not a document' });
      expect(resource.captured).not.toBeNull();
    });

    it('shows an OpenAPI error status', () => {
      const resource = pick({ openApi: { status: 'error', url: `${API}/api`, description: null, captured: answer('/api', 404, 30) } }, 'openApi');
      expect(resource).toMatchObject({ status: 404, note: null, facts: ['30 ms', '1.1 KB'] });
    });

    it('says when no response came for OpenAPI', () => {
      expect(pick({ openApi: { status: 'error', url: `${API}/api`, description: null, captured: noAnswer('/api') } }, 'openApi')).toMatchObject({ status: null, note: 'no response' });
    });
  });

  describe('findings', () => {
    const errors = [
      { message: 'a', section: 'Landing Page' },
      { message: 'b', section: 'Landing Page', severity: 'info' as const },
      { message: 'c', section: 'Conformance' },
      { message: 'd', section: 'conformance', severity: 'warning' as const },
      { message: 'e', section: 'Collections' },
      { message: 'f', section: 'data link' },
      { message: 'g', section: 'collections endpoint' },
      { message: 'h' },
      { message: 'i', section: 'OpenAPI' },
      { message: 'j', section: 'Locations' },
      { message: 'k', section: 'landing page' },
      { message: 'l', section: 'unknown endpoint' },
    ];
    const validation = { isValid: false, errors, openApiValidation: { isValid: false, errors: null } };

    it('go to the resource they are about', () => {
      const of = (key: string) => pick({ validation, openApi: readyOpenApi() }, key).findings.map(finding => finding.message);
      expect(of('landingPage')).toEqual(['a', 'b', 'k', 'l']);
      expect(of('conformance')).toEqual(['c', 'd']);
      expect(of('collections')).toEqual(['e', 'f', 'g', 'h']);
      expect(of('openApi')).toEqual(['i']);
    });

    it('count problems and not notes', () => {
      expect(pick({ validation, openApi: readyOpenApi() }, 'landingPage').issues).toBe(3);
      expect(pick({ validation, openApi: readyOpenApi() }, 'conformance').issues).toBe(2);
    });

    it('add up to what the validation badge says, apart from a collection locations', () => {
      const resources = apiResources(inputs({ validation, openApi: readyOpenApi() }));
      const total = resources.reduce((sum, resource) => sum + (resource.issues ?? 0), 0);
      expect(total).toBe(problemCount(validation) - 1);
    });

    it('come with the schema that found them', () => {
      const named = { isValid: true, errors: null, landingPageValidation: { isValid: true, errors: null, schemaResults: [{ schema: 'One', isValid: true }, { schema: 'Two', isValid: true }] } };
      expect(pick({ validation: named }, 'landingPage').schemaName).toBe('One, Two');
      expect(pick({ validation: named }, 'conformance').schemaName).toBeNull();
    });
  });
});
