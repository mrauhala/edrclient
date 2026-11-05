import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResponseHeaders from './ResponseHeaders';

describe('ResponseHeaders', () => {
  it('lists each header with its value, in the given order', () => {
    const html = renderToStaticMarkup(
      <ResponseHeaders headers={[{ name: 'cache-control', value: 'max-age=60' }, { name: 'content-type', value: 'application/json' }]} />,
    );
    const cells = (tag: string) => [...html.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g'))].map(([, cell]) => cell);
    expect(cells('dt')).toEqual(['cache-control', 'content-type']);
    expect(cells('dd')).toEqual(['max-age=60', 'application/json']);
  });

  it('sets the names apart in the colour of the URL\'s parameter names', () => {
    const html = renderToStaticMarkup(<ResponseHeaders headers={[{ name: 'etag', value: 'x' }]} />);
    const name = html.match(/<dt[^>]*>/)?.[0].match(/css-[A-Za-z0-9-]+/)?.[0];
    expect(html).toMatch(new RegExp(`\\.${name}\\{[^}]*color:#1976d2`));
  });

  it('says the browser may hide some headers', () => {
    const html = renderToStaticMarkup(<ResponseHeaders headers={[]} />);
    expect(html).toContain('Access-Control-Expose-Headers');
  });
});
