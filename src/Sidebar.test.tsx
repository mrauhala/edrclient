import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Sidebar from './Sidebar';
import { PanesProvider } from './contexts/PanesContext';
import { REQUEST_WIDTH, type OpenPanes } from './panes';

vi.mock('./ServiceSelector', () => ({ default: () => <i>the form</i> }));
vi.mock('./ServiceInfoPanel', () => ({ default: () => <i>the details</i> }));
vi.mock('./CollectionsList', () => ({ default: () => <i>the list</i> }));

const ALL_OPEN: OpenPanes = { request: true, map: true, response: true };

const render = (isOpen: OpenPanes, isMobile = false) => renderToStaticMarkup(
  <PanesProvider value={{ isOpen, isMobile, togglePane: () => {}, showPane: () => {}, showMap: () => {} }}>
    <Sidebar />
  </PanesProvider>
);

// Each element's styles come before it: those of the outer box come first
const outerStyles = (html: string) => /<style[^>]*>(.*?)<\/style>/.exec(html)?.[1] ?? '';

describe('Sidebar', () => {
  it('holds the form, the details and the list, in that order', () => {
    const html = render(ALL_OPEN);
    expect(html.indexOf('the form')).toBeLessThan(html.indexOf('the details'));
    expect(html.indexOf('the details')).toBeLessThan(html.indexOf('the list'));
    expect(html.indexOf('the form')).toBeGreaterThan(-1);
  });

  it('has its own width beside other panes', () => {
    expect(outerStyles(render(ALL_OPEN))).toContain(`width:${REQUEST_WIDTH}px`);
    expect(outerStyles(render({ ...ALL_OPEN, map: false }))).toContain(`width:${REQUEST_WIDTH}px`);
    expect(outerStyles(render({ ...ALL_OPEN, response: false }))).toContain(`width:${REQUEST_WIDTH}px`);
  });

  it('takes the room alone, and on a phone', () => {
    expect(outerStyles(render({ request: true, map: false, response: false }))).toContain('width:100%');
    expect(outerStyles(render({ ...ALL_OPEN }, true))).toContain('width:100%');
  });

  it('stays mounted when closed, out of the tab order', () => {
    const html = render({ ...ALL_OPEN, request: false });
    expect(html).toContain('the form');
    expect(outerStyles(html)).toContain('width:0');
    expect(outerStyles(html)).toContain('visibility:hidden');
    expect(outerStyles(render(ALL_OPEN))).toContain('visibility:visible');
  });
});
