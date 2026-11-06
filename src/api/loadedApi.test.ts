import { describe, expect, it } from 'vitest';
import type { GetCollectionsResult, Link } from '../types/api';
import { apiOfRequest, licenseOf, loadedApiOf, NOTHING_LOADED, startingApiUrl } from './loadedApi';

const hash = (url: string) => `#request=${encodeURIComponent(url)}`;
const license = (href: string, title?: string): Link => ({ href, rel: 'license', title });
const SERVICES = ['https://listed.example/edr', 'https://slashed.example/edr/'];
const DEFAULT = 'https://default.example/edr';

describe('loadedApiOf', () => {
  it('takes what the API said about itself', () => {
    const links = [{ href: 'https://a.example/', rel: 'self' }];
    const collectionsLinks = [{ href: 'https://a.example/collections', rel: 'self' }];
    expect(loadedApiOf({
      collections: [],
      validation: { isValid: true, errors: null },
      landingPageTitle: 'Title',
      landingPageDescription: 'Description',
      landingPageKeywords: ['one'],
      landingPageLinks: links,
      collectionsLinks,
      conformsTo: ['conf'],
      captured: { landingPage: { url: 'https://a.example/?f=json', response: null, text: null, failure: 'x' } },
    } as GetCollectionsResult)).toEqual({
      captured: { landingPage: { url: 'https://a.example/?f=json', response: null, text: null, failure: 'x' } },
      title: 'Title',
      description: 'Description',
      keywords: ['one'],
      links,
      collectionsLinks,
      conformsTo: ['conf'],
    });
  });

  it('holds nothing for what it left out', () => {
    expect(loadedApiOf({ collections: [], validation: { isValid: false, errors: null } } as GetCollectionsResult)).toEqual(NOTHING_LOADED);
  });
});

describe('licenseOf', () => {
  const CC = 'https://creativecommons.org/licenses/by/4.0/';
  const MIT = 'https://opensource.org/licenses/MIT';

  it('prefers what the list of collections links to', () => {
    expect(licenseOf({ collectionsLinks: [license(CC, 'From the list')], links: [license(MIT, 'From the landing page')] })?.href).toBe(CC);
  });

  it('falls back on the landing page', () => {
    expect(licenseOf({ collectionsLinks: [{ href: CC, rel: 'self' }], links: [license(MIT)] })?.href).toBe(MIT);
    expect(licenseOf({ collectionsLinks: null, links: [license(MIT)] })?.href).toBe(MIT);
  });

  it('is nothing without a licence link', () => {
    expect(licenseOf({ collectionsLinks: null, links: null })).toBeNull();
    expect(licenseOf({ collectionsLinks: [{ href: CC, rel: 'self' }], links: [] })).toBeNull();
  });
});

describe('apiOfRequest', () => {
  it('uses the entry of the list that is the API', () => {
    expect(apiOfRequest('https://listed.example/edr/collections/a/position?coords=POINT(1 1)', SERVICES)).toBe('https://listed.example/edr');
  });

  it('keeps the slash the entry has', () => {
    expect(apiOfRequest('https://slashed.example/edr/collections/a', SERVICES)).toBe('https://slashed.example/edr/');
  });

  it('works an unlisted API out from the URL, at whatever path', () => {
    expect(apiOfRequest('https://other.example/deep/api/collections/a/items', SERVICES)).toBe('https://other.example/deep/api');
  });
});

describe('startingApiUrl', () => {
  it('starts on the default without a link', () => {
    expect(startingApiUrl('', SERVICES, DEFAULT)).toBe(DEFAULT);
    expect(startingApiUrl('#something-else', SERVICES, DEFAULT)).toBe(DEFAULT);
  });

  it("starts on a link's API", () => {
    expect(startingApiUrl(hash('https://slashed.example/edr/collections/a/position'), SERVICES, DEFAULT)).toBe('https://slashed.example/edr/');
    expect(startingApiUrl(hash('https://other.example/api/collections/a'), SERVICES, DEFAULT)).toBe('https://other.example/api');
  });

  it("doesn't follow a link it wouldn't send", () => {
    expect(startingApiUrl(hash('javascript:alert(1)'), SERVICES, DEFAULT)).toBe(DEFAULT);
  });
});
