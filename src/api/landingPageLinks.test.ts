import { describe, expect, it } from 'vitest';
import { classifyDataLinks, dataLinkUrls, hasCollectionsList } from './landingPageLinks';
import type { Link } from '../types/api';

const API = 'https://meteocore.app.meteo.fi/edr';
const link = (rel: string, href: string): Link => ({ rel, href, type: 'application/json' }) as Link;

describe('dataLinkUrls', () => {
  it("counts the EDR rel and Common's URI rel on one href as one URL (MeteoCore)", () => {
    expect(dataLinkUrls([
      link('data', `${API}/collections`),
      link('http://www.opengis.net/def/rel/ogc/1.0/data', `${API}/collections`),
      link('conformance', `${API}/conformance`),
    ], API)).toEqual([`${API}/collections`]);
  });

  it('keeps distinct URLs, in order, resolving relative hrefs', () => {
    expect(dataLinkUrls([link('data', 'collections'), link('data', `${API}/other`)], `${API}/`))
      .toEqual([`${API}/collections`, `${API}/other`]);
  });

  it('finds none without a data link', () => {
    expect(dataLinkUrls([link('self', API)], API)).toEqual([]);
  });
});

describe('classifyDataLinks', () => {
  const MG = 'https://api.meteogate.eu/eu-eumetnet-climate-observations/v1';

  it('takes a conformance declaration linked as data out of the collections candidates (Meteogate)', () => {
    expect(classifyDataLinks([`${MG}/conformance`, `${MG}/collections`]))
      .toEqual({ collections: [`${MG}/collections`], conformance: `${MG}/conformance` });
  });

  it('tries links to /collections first, keeping the order otherwise', () => {
    expect(classifyDataLinks([`${API}/other`, `${API}/collections/`, `${API}/more`]))
      .toEqual({ collections: [`${API}/collections/`, `${API}/other`, `${API}/more`], conformance: null });
  });

  it('matches whole path segments, ignoring the query', () => {
    expect(classifyDataLinks([`${API}/myconformance`, `${API}/collections?f=json`]))
      .toEqual({ collections: [`${API}/collections?f=json`, `${API}/myconformance`], conformance: null });
  });

  it('can leave no collections candidate', () => {
    expect(classifyDataLinks([`${MG}/conformance`])).toEqual({ collections: [], conformance: `${MG}/conformance` });
    expect(classifyDataLinks([])).toEqual({ collections: [], conformance: null });
  });
});

describe('hasCollectionsList', () => {
  it('accepts a collections array or a bare array', () => {
    expect(hasCollectionsList({ collections: [] })).toBe(true);
    expect(hasCollectionsList([{ id: 'a' }])).toBe(true);
  });

  it('rejects anything else, such as a conformance declaration', () => {
    expect(hasCollectionsList({ conformsTo: ['http://www.opengis.net/spec/ogcapi-edr-1/1.1/conf/core'] })).toBe(false);
    expect(hasCollectionsList({ collections: {} })).toBe(false);
    expect(hasCollectionsList(null)).toBe(false);
    expect(hasCollectionsList('<html>')).toBe(false);
  });
});
