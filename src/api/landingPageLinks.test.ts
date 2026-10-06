import { describe, expect, it } from 'vitest';
import { dataLinkUrls } from './landingPageLinks';
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
