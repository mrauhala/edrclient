import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Sidebar from './Sidebar';
import { PanesProvider } from './contexts/PanesContext';
import { REQUEST_WIDTH, type OpenPanes } from './panes';

vi.mock('./ServiceSelector', () => ({ default: () => <i>the form</i> }));
vi.mock('./ServiceInfoPanel', () => ({ default: () => <i>the details</i> }));
vi.mock('./CollectionsList', () => ({ default: () => <i>the list</i> }));
vi.mock('./CollectionPane', () => ({ default: () => <i>the request</i> }));

const ON_REQUEST: OpenPanes = { api: false, request: true, map: true, response: true };
const ON_API: OpenPanes = { api: true, request: false, map: true, response: true };

const render = (isOpen: OpenPanes, isMobile = false) => renderToStaticMarkup(
  <PanesProvider value={{ isOpen, isMobile, togglePane: () => {}, showPane: () => {}, showMap: () => {} }}>
    <Sidebar />
  </PanesProvider>
);

// Each element's styles come just before it
const stylesOf = (html: string, before: string) => {
  const upTo = html.slice(0, html.indexOf(before));
  return [...upTo.matchAll(/<style[^>]*>(.*?)<\/style>/g)].at(-1)?.[1] ?? '';
};
const place = (html: string) => stylesOf(html, 'id="sidebar"');
const pane = (html: string, id: string) => stylesOf(html, `id="${id}"`);

describe('Sidebar', () => {
  it('holds the form, the details and the list in the API pane, and the request in its own', () => {
    const html = render(ON_API);
    const [api, request] = [html.indexOf('id="api-pane"'), html.indexOf('id="request-pane"')];
    expect(api).toBeGreaterThan(-1);
    expect(api).toBeLessThan(html.indexOf('the form'));
    expect(html.indexOf('the form')).toBeLessThan(html.indexOf('the details'));
    expect(html.indexOf('the details')).toBeLessThan(html.indexOf('the list'));
    expect(html.indexOf('the list')).toBeLessThan(request);
    expect(request).toBeLessThan(html.indexOf('the request'));
  });

  it('names the panes for screen readers', () => {
    const html = render(ON_API);
    expect(html).toContain('aria-label="API"');
    expect(html).toContain('aria-label="Request"');
  });

  it('keeps both mounted, hiding the one not showing', () => {
    const onApi = render(ON_API);
    expect(pane(onApi, 'api-pane')).toContain('visibility:inherit');
    expect(pane(onApi, 'request-pane')).toContain('visibility:hidden');

    const onRequest = render(ON_REQUEST);
    expect(pane(onRequest, 'api-pane')).toContain('visibility:hidden');
    expect(pane(onRequest, 'request-pane')).toContain('visibility:inherit');
    expect(onRequest).toContain('the list');
    expect(onRequest).toContain('the request');
  });

  it('has its own width beside other panes', () => {
    expect(place(render(ON_REQUEST))).toContain(`width:${REQUEST_WIDTH}px`);
    expect(place(render({ ...ON_REQUEST, map: false }))).toContain(`width:${REQUEST_WIDTH}px`);
    expect(place(render({ ...ON_API, response: false }))).toContain(`width:${REQUEST_WIDTH}px`);
    expect(pane(render(ON_API), 'api-pane')).toContain(`width:${REQUEST_WIDTH}px`);
  });

  it('takes the room alone, and on a phone', () => {
    const alone = render({ api: false, request: true, map: false, response: false });
    expect(place(alone)).toContain('width:100%');
    expect(pane(alone, 'request-pane')).toContain('width:100%');
    const phone = render(ON_API, true);
    expect(place(phone)).toContain('width:100%');
    expect(pane(phone, 'api-pane')).toContain('min-width:100vw');
  });

  it('stays mounted when closed, out of the tab order', () => {
    const html = render({ api: false, request: false, map: true, response: true });
    expect(html).toContain('the form');
    expect(place(html)).toContain('width:0');
    expect(place(html)).toContain('visibility:hidden');
    expect(place(render(ON_API))).toContain('visibility:visible');
  });
});
