import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { detectEdrVersion, validateLocationsResponse } from './locationsValidator';
import meteogate from './__fixtures__/meteogate-nl-daily-locations.json';

// The validator fetches its schema from the app's public directory
beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(join('public', url), 'utf8')));
});
afterAll(() => vi.unstubAllGlobals());

describe('detectEdrVersion', () => {
  const core = (version: string) => `http://www.opengis.net/spec/ogcapi-edr-1/${version}/conf/core`;

  it('picks the newest EDR version declared', () => {
    expect(detectEdrVersion([core('1.0'), core('1.1')])).toBe('1.1');
    expect(detectEdrVersion([core('1.2')])).toBe('1.2');
  });

  it('finds none for a service that is not EDR', () => {
    expect(detectEdrVersion(['http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core'])).toBeNull();
    expect(detectEdrVersion(null)).toBeNull();
  });
});

describe('validateLocationsResponse', () => {
  it('reports a property missing from every feature once, with how many features lack it (Meteogate)', async () => {
    const { isValid, errors } = await validateLocationsResponse(meteogate.response, '1.1');
    expect(isValid).toBe(false);
    const messages = errors.map(error => error.message);
    expect(messages).toContain("/features/*/properties: must have required property 'datetime' (5 of 5 features)");
    expect(messages).toContain("/features/*/properties: must have required property 'label' (5 of 5 features)");
    // One error per kind, not per feature; each points at the first feature, for navigation
    expect(errors.length).toBeLessThan(10);
    expect(errors.every(error => error.path === '/features/0/properties' && error.section === 'Locations')).toBe(true);
  });

  it('keeps a single error as it is', async () => {
    const response = structuredClone(meteogate.response);
    response.features = response.features.slice(0, 1);
    const { errors } = await validateLocationsResponse(response, '1.1');
    expect(errors.map(error => error.message)).toContain("/features/0/properties: must have required property 'datetime'");
  });

  it('accepts a valid locations response', async () => {
    const response = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: 'a', geometry: { type: 'Point', coordinates: [24.9, 60.2] },
        properties: { datetime: '2026-11-01T00:00:00Z/..', label: 'A', 'parameter-name': ['t2m'], edrqueryendpoint: 'https://example.org/edr/collections/c/locations/a' },
      }],
    };
    expect(await validateLocationsResponse(response, '1.1')).toEqual({ isValid: true, errors: [] });
  });
});
