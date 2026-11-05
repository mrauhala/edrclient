import { describe, expect, it } from 'vitest';
import { encodedUrl, isSendableUrl, mergeEditedUrl, readableUrl, shortUrl } from './requestUrl';

const BASE = 'https://api.test/edr/collections/c/position';

describe('readableUrl', () => {
  it('shows what the form encoded as itself', () => {
    expect(readableUrl(`${BASE}?coords=POINT%2824.940+60.170%29&parameter-name=a%2Cb&datetime=2026-11-05T00%3A00%3A00Z%2F2026-11-06T00%3A00%3A00Z&f=CoverageJSON`))
      .toBe(`${BASE}?coords=POINT(24.940 60.170)&parameter-name=a,b&datetime=2026-11-05T00:00:00Z/2026-11-06T00:00:00Z&f=CoverageJSON`);
  });

  it.each([
    ['plus', 'application/vnd.cov%2Bjson', 'application/vnd.cov%2Bjson'],
    ['ampersand', 'a%26b', 'a%26b'],
    ['equals', 'a%3Db', 'a%3Db'],
    ['hash', 'a%23b', 'a%23b'],
    ['percent', '100%25', '100%25'],
  ])('keeps a %s in a value encoded', (_name, value, shown) => {
    expect(readableUrl(`${BASE}?f=${value}`)).toBe(`${BASE}?f=${shown}`);
  });

  it('means the same as the URL it came from', () => {
    const url = `${BASE}?coords=POINT%2824.940+60.170%29&f=a%2Bb%26c%3Dd%23e%25f`;
    const before = [...new URL(url).searchParams];
    expect([...new URL(readableUrl(url)).searchParams]).toEqual(before);
  });

  it('leaves the path and fragment alone, also without a query', () => {
    expect(readableUrl('https://api.test/a%20b')).toBe('https://api.test/a%20b');
    expect(readableUrl(`${BASE}?f=x#part`)).toBe(`${BASE}?f=x#part`);
  });

  it('gives the same result when applied twice', () => {
    const once = readableUrl(`${BASE}?coords=POINT%281+2%29&f=a%2Bb`);
    expect(readableUrl(once)).toBe(once);
  });

  it('returns what it can\'t parse as it came', () => {
    expect(readableUrl('not a url')).toBe('not a url');
  });
});

describe('isSendableUrl', () => {
  it.each(['https://api.test/edr', 'http://localhost:8000/edr?f=x y'])('sends %s', url => {
    expect(isSendableUrl(url)).toBe(true);
  });

  it.each(['', '/collections/c', 'api.test/edr', 'ftp://api.test/edr', 'javascript:alert(1)'])('refuses "%s"', url => {
    expect(isSendableUrl(url)).toBe(false);
  });
});

describe('encodedUrl', () => {
  it('encodes spaces, and keeps what reads the same in a query', () => {
    expect(encodedUrl(`${BASE}?coords=POINT(24.94 60.17)&parameter-name=a,b`))
      .toBe(`${BASE}?coords=POINT(24.94%2060.17)&parameter-name=a,b`);
  });

  it('returns what it can\'t parse as it came', () => {
    expect(encodedUrl('not a url')).toBe('not a url');
  });
});

describe('shortUrl', () => {
  it('starts at the collection, and still reads like the URL', () => {
    expect(shortUrl(`${BASE}?coords=POINT(24.94 60.17)&f=x`)).toBe('…/c/position?coords=POINT(24.94 60.17)&f=x');
  });

  it('starts at the path without a collection', () => {
    expect(shortUrl('https://api.test/edr/conformance?f=json')).toBe('…/edr/conformance?f=json');
  });

  it('keeps a fragment', () => {
    expect(shortUrl(`${BASE}#part`)).toBe('…/c/position#part');
  });

  it("shows what isn't a URL as it is", () => {
    expect(shortUrl('/collections/c')).toBe('/collections/c');
  });
});

describe('mergeEditedUrl', () => {
  const built = (query: string) => `${BASE}?${query}`;

  it('writes in a point the form changed, and keeps a typed parameter', () => {
    expect(mergeEditedUrl(
      built('coords=POINT(1 2)&f=x'),
      built('coords=POINT(3 4)&f=x'),
      built('coords=POINT(1 2)&f=x&parameter-name=nope'),
    )).toBe(built('coords=POINT(3 4)&f=x&parameter-name=nope'));
  });

  it('lets a choice made in the form replace what was typed for it', () => {
    expect(mergeEditedUrl(
      built('f=x'),
      built('f=x&parameter-name=temperature'),
      built('f=x&parameter-name=nope&a=b'),
    )).toBe(built('f=x&parameter-name=temperature&a=b'));
  });

  it('has no edits left when that choice was the only one', () => {
    expect(mergeEditedUrl(
      built('f=x'),
      built('f=x&parameter-name=temperature'),
      built('f=x&parameter-name=nope'),
    )).toBeNull();
  });

  it('starts again from the form for another query', () => {
    expect(mergeEditedUrl(built('f=x'), 'https://api.test/edr/collections/c/area?f=x', built('f=x&a=b'))).toBeNull();
  });

  it('starts again when the form has nothing left', () => {
    expect(mergeEditedUrl(built('f=x'), '', built('f=x&a=b'))).toBeNull();
  });

  it('starts again from the form when the field was emptied', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=y'), '')).toBeNull();
    expect(mergeEditedUrl(built('f=x'), built('f=y'), '   ')).toBeNull();
  });

  it('adds a parameter the form starts to use', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=x&z=1'), built('f=x&a=b'))).toBe(built('f=x&a=b&z=1'));
  });

  it('removes a parameter the form stops using', () => {
    expect(mergeEditedUrl(built('f=x&z=1'), built('f=x'), built('f=x&z=1&a=b'))).toBe(built('f=x&a=b'));
  });

  it('leaves no question mark behind when the last parameter goes', () => {
    expect(mergeEditedUrl(built('f=x&z=1'), built('f=x'), built('z=1'))).toBe(BASE);
  });

  it('keeps a value typed over one the form stops using', () => {
    expect(mergeEditedUrl(built('coords=POINT(1 2)'), BASE, built('coords=POINT(9 9)')))
      .toBe(built('coords=POINT(9 9)'));
  });

  it('keeps what was typed for parameters the form left alone, with its encoding and order', () => {
    expect(mergeEditedUrl(
      built('coords=POINT(1 2)&f=x'),
      built('coords=POINT(3 4)&f=x'),
      built('f=%78&a=1+2&b=%20&coords=POINT(1 2)'),
    )).toBe(built('f=%78&a=1+2&b=%20&coords=POINT(3 4)'));
  });

  it('keeps a path that was typed', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=y'), 'https://other.test/typed?f=x&a=b'))
      .toBe('https://other.test/typed?f=y&a=b');
  });

  it('collapses a parameter repeated by hand when the form sets it', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=y'), built('f=1&a=b&f=2'))).toBe(built('f=y&a=b'));
  });

  it('keeps a fragment that was typed', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=y'), `${built('f=x&a=b')}#part`)).toBe(`${built('f=y&a=b')}#part`);
  });

  it('encodes what it writes in the way the form\'s URLs read', () => {
    expect(mergeEditedUrl(built('a=1'), built('a=x%2By'), built('a=1&b=2'))).toBe(built('a=x%2By&b=2'));
  });

  it('has no edits left once the URL is what the form builds', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=y'), built('f=x'))).toBeNull();
  });

  it('copes with text that isn\'t a URL', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=y'), 'typo')).toBe('typo?f=y');
  });

  it('copes with broken encoding', () => {
    expect(mergeEditedUrl(built('f=x'), built('f=y'), built('f=x&a=%E0%A4%A'))).toBe(built('f=y&a=%E0%A4%A'));
  });

  it('removes all of the pairs the form had, when typed the same', () => {
    expect(mergeEditedUrl(built('z=1'), BASE, built('z=1&a=b&z=1'))).toBe(built('a=b'));
  });
});
