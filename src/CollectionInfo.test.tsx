import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CollectionInfo, { CollectionAbout, CollectionDescription, aboutCollection, aboutSummary, parseLicense } from './CollectionInfo';
import type { Collection } from './types/api';

const collection = (fields: object = {}) => ({ id: 'one', title: 'First', links: [], ...fields }) as unknown as Collection;
const CC_BY = { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' };
const TEMPORAL = { interval: [['2026-11-01T00:00:00Z', '2026-11-03T00:00:00Z']], trs: 'x' };
const VERTICAL = { interval: [['850', '1000']], vrs: 'x' };

describe('parseLicense', () => {
  it('names Creative Commons licences', () => {
    expect(parseLicense('https://creativecommons.org/licenses/by-nc-nd/4.0/')?.label).toBe('CC BY-NC-ND 4.0');
    expect(parseLicense('https://creativecommons.org/publicdomain/zero/1.0/')?.label).toBe('CC0 1.0');
  });

  it('uses the title for anything else, or says License', () => {
    expect(parseLicense('https://a.example/terms', 'The terms')?.label).toBe('The terms');
    expect(parseLicense('https://a.example/terms')?.label).toBe('License');
    expect(parseLicense('not a url', 'The terms')?.label).toBe('The terms');
  });

  it('takes the first of a map of addresses, and nothing from none', () => {
    expect(parseLicense({ en: 'https://a.example/en', fr: 'https://a.example/fr' })?.href).toBe('https://a.example/en');
    expect(parseLicense('')).toBeNull();
  });
});

describe('aboutCollection', () => {
  it('finds nothing in a collection that says nothing', () => {
    expect(aboutCollection(collection(), null)).toEqual({ crs: null, time: null, levels: null, itemType: null, license: null, keywords: [] });
  });

  it('reads what it says', () => {
    const about = aboutCollection(collection({
      extent: { spatial: { crs: 'CRS84' }, temporal: TEMPORAL, vertical: VERTICAL },
      itemType: 'feature',
      keywords: ['a'],
    }), null);
    expect(about).toMatchObject({ crs: 'CRS84', itemType: 'feature', keywords: ['a'] });
    expect(about.time).toContain('2026');
    expect(about.levels).toContain('850');
  });

  it("prefers the collection's own licence to the API's", () => {
    expect(aboutCollection(collection(), CC_BY).license).toBe(CC_BY);
    const own = collection({ links: [{ href: 'https://a.example/terms', rel: 'license', title: 'Its own' }] });
    expect(aboutCollection(own, CC_BY).license?.label).toBe('Its own');
  });

  it('ignores keywords that are no list, as an API under test may send', () => {
    expect(aboutCollection(collection({ keywords: 'one, two' }), null).keywords).toEqual([]);
  });

  it('copes with links left out', () => {
    expect(aboutCollection(collection({ links: undefined }), CC_BY).license).toBe(CC_BY);
  });
});

describe('aboutSummary', () => {
  const about = aboutCollection(collection(), null);

  it('is empty with nothing to say', () => {
    expect(aboutSummary(about)).toBe('');
  });

  it('lists what there is, in order', () => {
    expect(aboutSummary({ crs: 'CRS84', time: 't', levels: 'l', itemType: 'i', license: CC_BY, keywords: ['a', 'b'] }))
      .toBe('CRS, time, levels, item type, license, 2 keywords');
  });

  it('counts one keyword as one', () => {
    expect(aboutSummary({ ...about, keywords: ['a'] })).toBe('1 keyword');
  });
});

describe('CollectionDescription', () => {
  it('shows the description and any thumbnail', () => {
    const html = renderToStaticMarkup(<CollectionDescription collection={collection({ description: 'What it holds', assets: { thumbnail: { href: 'https://a.example/t.png', title: 'A picture' } } })} />);
    expect(html).toContain('What it holds');
    expect(html).toContain('src="https://a.example/t.png"');
    expect(html).toContain('alt="A picture"');
  });

  it('is nothing without a description', () => {
    expect(renderToStaticMarkup(<CollectionDescription collection={collection()} />)).toBe('');
  });

  it('clamps long ones when asked', () => {
    const description = collection({ description: 'What it holds' });
    expect(renderToStaticMarkup(<CollectionDescription collection={description} clamp />)).toContain('-webkit-line-clamp:6');
    expect(renderToStaticMarkup(<CollectionDescription collection={description} />)).not.toContain('-webkit-line-clamp');
  });
});

describe('CollectionAbout', () => {
  it('shows each thing it knows', () => {
    const html = renderToStaticMarkup(<CollectionAbout about={{ crs: 'CRS84', time: 'A time', levels: 'Some levels', itemType: 'feature', license: CC_BY, keywords: ['weather'] }} />);
    for (const text of ['CRS84', 'A time', 'Some levels', 'feature', 'CC BY 4.0', 'weather', 'Keywords']) {
      expect(html).toContain(text);
    }
    expect(html).toContain(`href="${CC_BY.href}"`);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('leaves out what it does not', () => {
    expect(renderToStaticMarkup(<CollectionAbout about={aboutCollection(collection(), null)} />)).toBe('');
  });

  it('draws a line above only when asked', () => {
    const about = aboutCollection(collection({ itemType: 'feature' }), null);
    expect(renderToStaticMarkup(<CollectionAbout about={about} divider />)).toContain('MuiDivider');
    expect(renderToStaticMarkup(<CollectionAbout about={about} />)).not.toContain('MuiDivider');
  });
});

describe('CollectionInfo', () => {
  const render = (props: object, fields: object = {}) => renderToStaticMarkup(<CollectionInfo collection={collection(fields)} {...props} />);

  it('shows the title and the ID below it, or the ID alone', () => {
    expect(render({})).toContain('First');
    expect(render({})).toContain('>one<');
    expect(render({}, { title: undefined })).toContain('>one<');
  });

  it('shows the validation footer as asked', () => {
    expect(render({})).not.toContain('Valid');
    expect(render({ validationErrors: [] })).toContain('✓ Valid');
    expect(render({ validationErrors: [{ message: 'x' }] })).toContain('⚠ 1 issue');
    expect(render({ validationErrors: [{ message: 'x' }, { message: 'y' }] })).toContain('⚠ 2 issues');
  });

  it('badges the extents it has', () => {
    const html = render({}, { extent: { spatial: { bbox: [[1, 2, 3, 4]] }, temporal: TEMPORAL, vertical: VERTICAL, custom: [{ id: 'run' }] } });
    for (const label of ['Spatial', 'Temporal', 'Vertical', 'run']) expect(html).toContain(`>${label}<`);
  });

  it('shows the description, details and queries, except compact', () => {
    const fields = { description: 'What it holds', itemType: 'feature', keywords: ['weather'], data_queries: { position: { link: { href: 'https://a.example/p', rel: 'data' } } } };
    const html = render({}, fields);
    for (const text of ['What it holds', '>feature<', 'weather', '>POSITION<']) expect(html).toContain(text);
    const compact = render({ compact: true }, fields);
    for (const text of ['What it holds', '>feature<', 'weather', '>POSITION<']) expect(compact).not.toContain(text);
  });

  it('calls a collection with only an items link queryable by items', () => {
    expect(render({}, { links: [{ href: 'https://a.example/items', rel: 'items' }] })).toContain('>ITEMS<');
  });

  it("falls back on the API's licence", () => {
    expect(render({ fallbackLicense: CC_BY })).toContain('CC BY 4.0');
  });
});
