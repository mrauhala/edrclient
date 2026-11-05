import { describe, expect, it } from 'vitest';
import { apiRootOf, collectionIdOf, curlCommand, isJustCollection, knownServiceUrl, requestFromHash, requestLink, requestRoute } from './requestLink';

const PAGE = 'https://ogcbrowser.rauhala.app/';
const REQUEST = 'https://api.test/edr/collections/c/position?coords=POINT(24.94 60.17)&f=a%2Bb&parameter-name=x,y';

describe('requestLink', () => {
  it('puts the request in the fragment, encoded', () => {
    const link = requestLink(REQUEST, PAGE);
    expect(link.startsWith(`${PAGE}#request=https%3A%2F%2Fapi.test%2Fedr`)).toBe(true);
    expect(new URL(link).search).toBe('');
  });

  it('replaces a request already in the address', () => {
    expect(requestLink('https://api.test/two', `${PAGE}#request=https%3A%2F%2Fapi.test%2Fone`))
      .toBe(`${PAGE}#request=https%3A%2F%2Fapi.test%2Ftwo`);
  });

  it('keeps the path the app is served from', () => {
    expect(requestLink('https://api.test/x', 'https://mrauhala.github.io/ogcapi-browser/').startsWith('https://mrauhala.github.io/ogcapi-browser/#request=')).toBe(true);
  });

  it('comes back as it went, with what would change its meaning still encoded', () => {
    expect(requestFromHash(new URL(requestLink(REQUEST, PAGE)).hash)).toBe(REQUEST);
  });

  it('survives a long polygon', () => {
    const url = `https://api.test/c/area?coords=POLYGON((${'1.5 2.5,'.repeat(500)}1.5 2.5))`;
    expect(requestFromHash(new URL(requestLink(url, PAGE)).hash)).toBe(url);
  });

  it('survives broken encoding, which may be what is being tested', () => {
    const url = 'https://api.test/x?a=%E0%A4%A&b=%';
    expect(requestFromHash(new URL(requestLink(url, PAGE)).hash)).toBe(url);
  });
});

describe('requestFromHash', () => {
  it.each(['', '#', '#other=1', '#request=', '#request=/collections/c', '#request=javascript%3Aalert(1)', '#request=ftp%3A%2F%2Fa.test%2Fb', '#request=not%20a%20url'])(
    'finds nothing to send in "%s"', hash => {
      expect(requestFromHash(hash)).toBeNull();
    });

  it('finds it among other parts', () => {
    expect(requestFromHash('#a=1&request=https%3A%2F%2Fapi.test%2Fx')).toBe('https://api.test/x');
  });
});

describe('apiRootOf', () => {
  it.each([
    ['https://api.test/edr/collections/c/position?f=x', 'https://api.test/edr'],
    ['https://api.test/edr/collections', 'https://api.test/edr'],
    ['https://api.test/collections/c', 'https://api.test'],
    ['https://api.test/edr/conformance?f=json', 'https://api.test/edr'],
    ['https://api.test/edr/conformance/', 'https://api.test/edr'],
    ['https://api.test/edr/', 'https://api.test/edr'],
    // Served from a path called /api, as pygeoapi often is, which isn't the end of anything
    ['https://kralidis.ca/api/collections/msc-weather-forecast/position?coords=POINT(-119.227 72.565)', 'https://kralidis.ca/api'],
    ['https://kralidis.ca/api/collections', 'https://kralidis.ca/api'],
    ['https://kralidis.ca/api/conformance', 'https://kralidis.ca/api'],
    ['https://kralidis.ca/api', 'https://kralidis.ca/api'],
    ['https://kralidis.ca/api/', 'https://kralidis.ca/api'],
    ['https://api.test/edr/api', 'https://api.test/edr/api'],
    // Other names and depths
    ['https://demo.test/oapi/v1/collections/c/items?limit=1', 'https://demo.test/oapi/v1'],
    ['https://demo.test/conformance/collections/c', 'https://demo.test/conformance'],
    // A collection may have any name, and the first /collections is the one that counts
    ['https://api.test/edr/collections/api/position', 'https://api.test/edr'],
    ['https://api.test/edr/collections/conformance', 'https://api.test/edr'],
    ['https://api.test/edr/collections/collections/position', 'https://api.test/edr'],
    ['https://api.test/collections/c/instances/run/position', 'https://api.test'],
    ['https://api.test/edr', 'https://api.test/edr'],
    ['http://localhost:5000/a/b/collections/c', 'http://localhost:5000/a/b'],
  ])('takes %s to %s', (url, root) => {
    expect(apiRootOf(url)).toBe(root);
  });

  it('only cuts a whole path segment', () => {
    expect(apiRootOf('https://api.test/my-api')).toBe('https://api.test/my-api');
    expect(apiRootOf('https://api.test/collectionsx/y')).toBe('https://api.test/collectionsx/y');
  });
});

describe('collectionIdOf', () => {
  it('finds the collection, decoded', () => {
    expect(collectionIdOf('https://api.test/edr/collections/my%20c/position?f=x')).toBe('my c');
    expect(collectionIdOf('https://api.test/collections/ICON-D2-RUC@single_level')).toBe('ICON-D2-RUC@single_level');
  });

  it('finds none without one', () => {
    expect(collectionIdOf('https://api.test/edr')).toBeNull();
    expect(collectionIdOf('https://api.test/edr/collections')).toBeNull();
    expect(collectionIdOf('https://api.test/edr/collections/')).toBeNull();
  });

  it('copes with what it can\'t read', () => {
    expect(collectionIdOf('not a url')).toBeNull();
    expect(collectionIdOf('https://api.test/collections/a%E0%A4%A')).toBeNull();
  });
});

describe('isJustCollection', () => {
  it('is for a URL that stops at its collection', () => {
    expect(isJustCollection('https://api.test/collections/c')).toBe(true);
    expect(isJustCollection('https://api.test/collections/c/?f=json')).toBe(true);
  });

  it('is not for one that goes on, or has none', () => {
    expect(isJustCollection('https://api.test/collections/c/position')).toBe(false);
    expect(isJustCollection('https://api.test/edr')).toBe(false);
  });
});

describe('requestRoute', () => {
  const HERE = 'https://api.test/edr/';

  it('opens another collection on this API, whether or not its address ends in a slash', () => {
    expect(requestRoute('https://api.test/edr/collections/other/position?f=x', HERE)).toBe('collection');
    expect(requestRoute('https://api.test/edr/collections/other', 'https://api.test/edr')).toBe('collection');
  });

  it('knows an API served from a path called /api', () => {
    expect(requestRoute('https://kralidis.ca/api/collections/c/position', 'https://kralidis.ca/api')).toBe('collection');
    expect(requestRoute('https://kralidis.ca/api/collections/c/position', 'https://kralidis.ca')).toBe('api');
  });

  it('loads another API first', () => {
    expect(requestRoute('https://other.test/edr/collections/c/position', HERE)).toBe('api');
    expect(requestRoute('https://api.test/other/collections/c', HERE)).toBe('api');
    expect(requestRoute('https://api.test/edr/collections/c', null)).toBe('api');
  });

  it('leaves everything alone for a URL with no collection in it', () => {
    expect(requestRoute('https://api.test/edr/conformance', HERE)).toBe('none');
    expect(requestRoute('http://localhost:5000/echo?a=1', HERE)).toBe('none');
    expect(requestRoute('not a url', HERE)).toBe('none');
  });
});

describe('knownServiceUrl', () => {
  const SERVICES = ['https://opendata.fmi.fi/edr', 'https://meteocore.app.meteo.fi/edr/'];

  it('finds a service with or without its slash', () => {
    expect(knownServiceUrl('https://meteocore.app.meteo.fi/edr', SERVICES)).toBe('https://meteocore.app.meteo.fi/edr/');
    expect(knownServiceUrl('https://opendata.fmi.fi/edr', SERVICES)).toBe('https://opendata.fmi.fi/edr');
  });

  it('finds none for another API', () => {
    expect(knownServiceUrl('https://meteocore.app.meteo.fi', SERVICES)).toBeUndefined();
  });
});

describe('curlCommand', () => {
  const ENCODED = "'https://api.test/edr/collections/c/position?coords=POINT(24.94%2060.17)&f=a%2Bb&parameter-name=x,y'";

  it('quotes the URL, with its spaces encoded', () => {
    expect(curlCommand(REQUEST)).toBe(`curl -i ${ENCODED}`);
  });

  it('keeps a quote from ending the argument', () => {
    expect(curlCommand("https://api.test/a'b")).toBe(`curl -i 'https://api.test/a'\\''b'`);
  });

  it.each([
    ['a bearer token', { bearerToken: 'SECRET' }, `curl -i -H 'Authorization: Bearer YOUR_TOKEN' ${ENCODED}`],
    ['a custom header', { customAuthHeader: 'SECRET' }, `curl -i -H 'Authorization: YOUR_AUTHORIZATION' ${ENCODED}`],
    ['a password', { username: 'SECRET', password: 'SECRET' }, `curl -i -u 'YOUR_USERNAME:YOUR_PASSWORD' ${ENCODED}`],
  ])('says where %s goes, without it', (_name, auth, command) => {
    expect(curlCommand(REQUEST, auth)).toBe(command);
  });

  it('says where an API key goes, without it', () => {
    const command = curlCommand('https://api.test/x?a=1', { apiKey: 'SECRET', apiKeyParam: 'key' });
    expect(command).toBe("curl -i 'https://api.test/x?a=1&key=YOUR_API_KEY'");
  });

  it('prefers a custom header, as sending does', () => {
    expect(curlCommand('https://api.test/x', { customAuthHeader: 'A', bearerToken: 'B', username: 'C' })).toContain('YOUR_AUTHORIZATION');
    expect(curlCommand('https://api.test/x', { bearerToken: 'B', username: 'C' })).toContain('YOUR_TOKEN');
  });
});
