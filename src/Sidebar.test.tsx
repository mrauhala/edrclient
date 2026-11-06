import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Sidebar from './Sidebar';
import { PanesProvider } from './contexts/PanesContext';
import { DEFAULT_REQUEST_WIDTH, MIN_REQUEST_WIDTH, PINNED_ROW_ROOM, type OpenPanes } from './panes';

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
  // What the browser remembers
  const saved: { value: string | null; key: string | null } = { value: null, key: null };
  beforeEach(() => {
    saved.value = null;
    saved.key = null;
    vi.stubGlobal('localStorage', { getItem: (key: string) => { saved.key = key; return saved.value; }, setItem: () => {} });
  });
  afterEach(() => vi.unstubAllGlobals());

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

  it('leaves room for the row pinned in the request pane when a field is scrolled into view', () => {
    const html = render(ON_REQUEST);
    expect(pane(html, 'request-pane')).toContain(`scroll-padding-top:${PINNED_ROW_ROOM}px`);
    expect(pane(html, 'api-pane')).toContain('scroll-padding-top:0px');
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

  describe('its width', () => {
    it('would like the default beside other panes, and gives way down to its minimum', () => {
      for (const open of [ON_REQUEST, { ...ON_REQUEST, map: false }, { ...ON_API, response: false }]) {
        const styles = place(render(open));
        expect(styles).toContain(`flex:0 1 ${DEFAULT_REQUEST_WIDTH}px`);
        expect(styles).toContain(`min-width:${MIN_REQUEST_WIDTH}px`);
      }
    });

    it('is the one remembered', () => {
      saved.value = '640';
      expect(place(render(ON_REQUEST))).toContain('flex:0 1 640px');
    });

    it('ignores one that is too narrow or not a number', () => {
      for (const value of ['100', 'abc']) {
        saved.value = value;
        expect(place(render(ON_REQUEST))).toContain(`flex:0 1 ${DEFAULT_REQUEST_WIDTH}px`);
      }
    });

    it('is remembered by its own name', () => {
      render(ON_REQUEST);
      expect(saved.key).toBe('requestPaneWidth');
    });

    it('fills the place, whatever that gives it, keeping its minimum', () => {
      const styles = pane(render(ON_API), 'api-pane');
      expect(styles).toContain('width:100%');
      expect(styles).toContain(`min-width:${MIN_REQUEST_WIDTH}px`);
    });

    it('has no animation, which would lag a drag', () => {
      expect(place(render(ON_REQUEST))).not.toContain('transition');
    });
  });

  describe('the divider', () => {
    it('is there beside the map or the response, sizing what is showing', () => {
      expect(render(ON_REQUEST)).toContain('aria-label="Request pane width"');
      expect(render({ ...ON_REQUEST, map: false })).toContain('aria-label="Request pane width"');
      expect(render({ ...ON_REQUEST, response: false })).toContain('aria-label="Request pane width"');
      expect(render(ON_API)).toContain('aria-label="API pane width"');
    });

    it('says the width', () => {
      saved.value = '640';
      expect(render(ON_REQUEST)).toContain('aria-valuenow="640"');
    });

    it('comes after the place, before what is beside it', () => {
      const html = render(ON_REQUEST);
      expect(html.indexOf('the request')).toBeLessThan(html.indexOf('role="separator"'));
    });

    it('is not there alone, closed or on a phone', () => {
      expect(render({ api: false, request: true, map: false, response: false })).not.toContain('role="separator"');
      expect(render({ api: false, request: false, map: true, response: true })).not.toContain('role="separator"');
      expect(render(ON_REQUEST, true)).not.toContain('role="separator"');
    });
  });

  it('takes the room alone, and on a phone', () => {
    const alone = render({ api: false, request: true, map: false, response: false });
    expect(place(alone)).toContain('flex:1');
    expect(place(alone)).not.toContain(`${DEFAULT_REQUEST_WIDTH}px`);
    expect(pane(alone, 'request-pane')).toContain('width:100%');
    const phone = render(ON_API, true);
    expect(place(phone)).toContain('width:100%');
    expect(place(phone)).not.toContain(`${DEFAULT_REQUEST_WIDTH}px`);
    expect(pane(phone, 'api-pane')).toContain('min-width:100vw');
  });

  it('stays mounted when closed, out of the tab order', () => {
    const html = render({ api: false, request: false, map: true, response: true });
    expect(html).toContain('the form');
    expect(place(html)).toContain('flex:0 0 0px');
    expect(place(html)).toContain('visibility:hidden');
    expect(place(html)).not.toContain(`min-width:${MIN_REQUEST_WIDTH}px`);
    expect(place(render(ON_API))).toContain('visibility:visible');
  });
});
