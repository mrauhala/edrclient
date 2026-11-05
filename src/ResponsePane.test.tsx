import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResponsePane from './ResponsePane';
import type { ResponseDetails } from './api/sendRequest';
import { RequestUrlContext } from './contexts/RequestUrlContext';

const URL_ = 'https://api.example.com/collections/a/position?coords=POINT(1%202)';
const OK: ResponseDetails = {
  status: 200,
  statusText: 'OK',
  timeMs: 2230,
  sizeBytes: 11,
  headers: [{ name: 'content-type', value: 'text/plain' }, { name: 'x-a', value: '1' }],
  contentType: 'text/plain',
  requestUrlBytes: 50,
  timing: null,
};
const BAD_REQUEST: ResponseDetails = { ...OK, status: 400, statusText: 'Bad Request' };
const COVERAGE = JSON.stringify({
  type: 'Coverage',
  domain: { type: 'Domain', domainType: 'PointSeries', axes: { x: { values: [1] }, y: { values: [2] }, t: { values: ['2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z'] } } },
  parameters: { a: { type: 'Parameter', observedProperty: { label: { en: 'A' } } } },
  ranges: { a: { type: 'NdArray', dataType: 'float', axisNames: ['t'], shape: [2], values: [1, 2] } },
});

const render = (props: Partial<ComponentProps<typeof ResponsePane>>, requestUrl = URL_) => renderToStaticMarkup(
  <RequestUrlContext.Provider value={{ requestUrl, isEdited: false, editUrl: () => {}, discardEdits: () => {}, pinUrl: () => {}, unpinUrl: () => {} }}>
    <ResponsePane open onClose={() => {}} url={URL_} data={null} contentType={null} isLoading={false} error={null} {...props} />
  </RequestUrlContext.Provider>,
);

// The tabs, by name, and the one that's selected
const tabsOf = (html: string) => [...html.matchAll(/<button[^>]*role="tab"[^>]*>(.*?)<\/button>/g)].map(match => ({
  name: match[1].replace(/<style.*?<\/style>/g, '').replace(/<[^>]+>/g, ''),
  selected: match[0].includes('aria-selected="true"'),
}));
const tabNames = (html: string) => tabsOf(html).map(tab => tab.name);
const selectedTab = (html: string) => tabsOf(html).find(tab => tab.selected)?.name;

describe('ResponsePane', () => {
  it('says what to do before anything has been sent', () => {
    const html = render({ url: '' }, '');
    expect(html).toContain('Nothing sent yet');
    expect(html).not.toContain('Copy URL');
    expect(html).toContain('aria-label="Close the response pane"');
  });

  describe('the URL', () => {
    it('has nothing to say before anything was sent, whatever the request line holds', () => {
      const html = render({ url: '' });
      expect(html).toContain('>Response<');
      expect(html).not.toContain('Sent:');
      expect(html).not.toContain('Copy URL');
    });

    it("doesn't repeat the request line", () => {
      const html = render({ data: 'hello world', contentType: 'text/plain', response: OK });
      expect(html).not.toContain('/position');
      expect(html).not.toContain('Copy URL');
      expect(html).not.toContain('Nothing sent yet');
    });

    it('says what was sent once the request line has moved on', () => {
      const html = render({ data: 'hello world', contentType: 'text/plain', response: OK }, 'https://api.example.com/collections/a/area');
      expect(html).toContain(`title="${URL_}"`);
      expect(html).toContain('Sent: …/a/position?coords=POINT(1 2)');
      expect(html).toContain('aria-label="Copy URL"');
    });

    it('says what a stored response is, which the request line never holds', () => {
      const html = render({ data: '{}', contentType: 'application/json' }, 'https://api.example.com/collections/a/area');
      expect(html).toContain('…/a/position?coords=POINT(1 2)');
      expect(html).not.toContain('Sent:');
    });

    it('has a heading instead while there is nothing else to say', () => {
      expect(render({ isLoading: true })).toContain('>Response<');
      expect(render({ data: 'hello world', contentType: 'text/plain', response: OK })).not.toContain('>Response<');
    });
  });

  it('shows a response with its status line and the ways to read it', () => {
    const html = render({ data: 'hello world', contentType: 'text/plain', response: OK });
    expect(html).toContain('200 OK');
    expect(html).toContain('2.23 s');
    expect(tabNames(html)).toEqual(['Raw', 'Headers', 'Sizes', 'Checks']);
    expect(selectedTab(html)).toBe('Raw');
    expect(html).toContain('hello world');
    expect(html).not.toContain('Content-Type:');
    expect(html).not.toContain('Transforming');
  });

  it('shows the text only on Raw', () => {
    const json = { contentType: 'application/json', response: OK };
    expect(render({ data: '{}', ...json })).toContain('role="list"');
    expect(render({ data: COVERAGE, ...json })).not.toContain('role="list"');
  });

  it('opens on the view of the data when there is one', () => {
    const html = render({ data: COVERAGE, contentType: 'application/prs.coverage+json', response: OK });
    expect(tabNames(html)).toEqual(['Data', 'Raw', 'Headers', 'Sizes', 'Checks']);
    expect(selectedTab(html)).toBe('Data');
    expect(html).not.toContain('NdArray');
  });

  it('opens on the image, with no Raw for it', () => {
    const html = render({ imageUrl: 'blob:abc', contentType: 'image/png', response: { ...OK, contentType: 'image/png' } });
    expect(tabNames(html)).toEqual(['Data', 'Headers', 'Sizes', 'Checks']);
    expect(selectedTab(html)).toBe('Data');
    expect(html).toContain('blob:abc');
  });

  it("offers the text's copy button beside the tabs, in no row of its own", () => {
    const html = render({ data: 'hello world', contentType: 'text/plain', response: OK });
    expect(html).toContain('aria-label="Copy the response"');
    expect(html).not.toContain('flagged');
    // An empty row, with only an empty space for flagged lines in it
    expect(html.replace(/<style.*?<\/style>/g, '')).not.toMatch(/<div[^>]*><div[^>]*><\/div><\/div>/);
  });

  it('counts the findings on the Checks tab', () => {
    const html = render({
      data: '{\n  "a": 1\n}',
      contentType: 'application/json',
      response: OK,
      validationSchemaName: 'Thing',
      validationErrors: [{ path: '/a', message: 'bad', severity: 'warning' }, { path: '/a', message: 'odd', severity: 'info' }],
    });
    expect(tabNames(html)).toContain('Checks1 issue');
  });

  it('flags the lines in Raw, however bad they are, in words that fit them all', () => {
    const html = render({
      data: '{\n  "a": 1,\n  "b": 2\n}',
      contentType: 'application/json',
      response: OK,
      validationSchemaName: 'Thing',
      validationErrors: [{ path: '/a', message: '/a: bad', severity: 'error' }, { path: '/b', message: '/b: odd', severity: 'info' }],
    });
    expect(html).toContain('2 lines flagged');
    expect(html).toContain('aria-label="Next flagged line"');
    expect(html).toContain('L2');
    expect(html).toContain('>bad<');
  });

  it("shows a failure's message and the body the server sent", () => {
    const html = render({ data: 'unknown parameter', contentType: 'text/plain', response: BAD_REQUEST, error: 'The server rejected the request (400).' });
    expect(html).toContain('400 Bad Request');
    expect(html).toContain('The server rejected the request (400).');
    expect(html).toContain('unknown parameter');
    expect(tabNames(html)).toEqual(['Raw', 'Headers', 'Sizes', 'Checks']);
  });

  it('says so when a response has no body', () => {
    const html = render({ data: '', contentType: 'text/plain', response: { ...OK, sizeBytes: 0 } });
    expect(html).toContain('The response has no body.');
    expect(html).not.toContain('aria-label="Copy the response"');
  });

  it("doesn't call an image a missing body", () => {
    const html = render({ imageUrl: 'blob:abc', contentType: 'image/png', response: { ...OK, contentType: 'image/png' } });
    expect(html).not.toContain('The response has no body.');
  });

  it('shows an image the server sent with a failure', () => {
    const html = render({ imageUrl: 'blob:abc', contentType: 'image/png', response: BAD_REQUEST, error: 'The server rejected the request (400).' });
    expect(html).toContain('The server rejected the request (400).');
    expect(html).toContain('blob:abc');
  });

  it('shows only the message when no response came', () => {
    const html = render({ error: 'Network error.' });
    expect(html).toContain('Network error.');
    expect(tabNames(html)).toEqual([]);
    expect(html).not.toContain('The response has no body.');
  });

  it('shows a stored response without a status line or tabs, but with its copy button', () => {
    const html = render({ data: 'stored', contentType: 'text/plain' });
    expect(html).toContain('Content-Type: text/plain');
    expect(html).toContain('stored');
    expect(tabNames(html)).toEqual([]);
    expect(html).toContain('aria-label="Copy the response"');
  });

  it('shows neither tabs nor a body while loading', () => {
    const html = render({ isLoading: true, response: OK, data: 'hello world', contentType: 'text/plain' });
    expect(tabNames(html)).toEqual([]);
    expect(html).not.toContain('hello world');
  });
});
