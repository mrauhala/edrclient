import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResponseHeaders from './ResponseHeaders';

describe('ResponseHeaders', () => {
  it('lists each header with its value, in the given order', () => {
    const html = renderToStaticMarkup(
      <ResponseHeaders headers={[{ name: 'cache-control', value: 'max-age=60' }, { name: 'content-type', value: 'application/json' }]} />,
    );
    // Without the styles the first of each element carries in front of it
    const markup = html.replace(/<style[^>]*>.*?<\/style>/g, '');
    const pairs = [...markup.matchAll(/<dt[^>]*>([^<]*)<\/dt><dd[^>]*>([^<]*)<\/dd>/g)].map(([, name, value]) => [name, value]);
    expect(pairs).toEqual([['cache-control', 'max-age=60'], ['content-type', 'application/json']]);
  });

  it('says the browser may hide some headers', () => {
    const html = renderToStaticMarkup(<ResponseHeaders headers={[]} />);
    expect(html).toContain('Access-Control-Expose-Headers');
  });
});
