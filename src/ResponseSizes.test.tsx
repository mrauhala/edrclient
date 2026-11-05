import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResponseSizes from './ResponseSizes';
import type { ResponseDetails } from './api/sendRequest';

const render = (overrides: Partial<ResponseDetails>) => renderToStaticMarkup(
  <ResponseSizes response={{ status: 200, statusText: 'OK', timeMs: 1, sizeBytes: 3099, headers: [], contentType: 'application/json', requestUrlBytes: 88, timing: null, ...overrides }} />,
);

// The value beside a label, as text
const row = (html: string, label: string) => {
  const at = html.indexOf(`>${label}</dt>`);
  expect(at).toBeGreaterThan(-1);
  const start = html.indexOf('<dd', at);
  return html.slice(html.indexOf('>', start) + 1, html.indexOf('</dd>', start));
};

describe('ResponseSizes', () => {
  it('gives a small figure in bytes, and a bigger one rounded and exact', () => {
    const html = render({});
    expect(row(html, 'URL')).toBe('88 B');
    expect(row(html, 'Body, unpacked')).toBe('3.1 KB (3099 B)');
  });

  it('says what a server like MeteoCore keeps hidden, and how to reveal it', () => {
    const html = render({ headers: [{ name: 'content-encoding', value: 'gzip' }] });
    expect(row(html, 'Body, on the wire')).toContain('Hidden');
    expect(row(html, 'Compression')).toContain('gzip, by how much is ');
    expect(row(html, 'Compression')).toContain('Hidden');
    expect(row(html, 'From the cache')).toContain('Hidden');
    expect(html).toContain('the API can send Content-Length or Timing-Allow-Origin');
    expect(html).toContain('the API can send Timing-Allow-Origin.');
  });

  it('shows what a server like FMI lets through, and that it could name the compression', () => {
    const html = render({ headers: [{ name: 'content-length', value: '723' }] });
    expect(row(html, 'Body, on the wire')).toBe('723 B');
    expect(row(html, 'Compression')).toBe('4.3×');
    expect(html).not.toContain('Content-Length or Timing-Allow-Origin');
    expect(html).toContain('list Content-Encoding in Access-Control-Expose-Headers');
  });

  it('says an uncompressed body is, like one from kralidis.ca', () => {
    const html = render({ sizeBytes: 135301, headers: [{ name: 'content-length', value: '135301' }] });
    expect(row(html, 'Compression')).toBe('None');
    expect(html).not.toContain('list Content-Encoding');
  });

  it('notices an encoding that made nothing smaller', () => {
    const html = render({ sizeBytes: 100, headers: [{ name: 'content-length', value: '120' }, { name: 'content-encoding', value: 'gzip' }] });
    expect(row(html, 'Compression')).toBe('None, despite gzip');
  });

  it('names the encoding beside the ratio', () => {
    const html = render({ headers: [{ name: 'content-length', value: '723' }, { name: 'content-encoding', value: 'gzip' }] });
    expect(row(html, 'Compression')).toBe('4.3×, gzip');
    expect(html).not.toContain('list Content-Encoding');
  });

  it('has nothing left to ask for with Timing-Allow-Origin, but the headers', () => {
    const html = render({ timing: { transferSize: 1023, encodedBodySize: 723, decodedBodySize: 3099 } });
    expect(row(html, 'Body, on the wire')).toBe('723 B');
    expect(row(html, 'From the cache')).toBe('No');
    expect(html).not.toContain('can send');
  });

  it('says when it came from the cache', () => {
    expect(row(render({ timing: { transferSize: 0, encodedBodySize: 723, decodedBodySize: 3099 } }), 'From the cache')).toBe('Yes');
  });

  it('never gives a size for headers, which a browser only pretends to know', () => {
    const html = render({ timing: { transferSize: 1023, encodedBodySize: 723, decodedBodySize: 3099 } });
    expect(row(html, 'Headers')).toContain('Hidden');
    expect(html).toContain('Browsers don&#x27;t tell a page how big headers are');
  });
});
