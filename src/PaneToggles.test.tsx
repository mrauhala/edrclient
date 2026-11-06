import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PaneToggles from './PaneToggles';
import { PanesProvider } from './contexts/PanesContext';
import type { OpenPanes } from './panes';

const render = (isOpen: OpenPanes, isMobile: boolean) => renderToStaticMarkup(
  <PanesProvider value={{ isOpen, isMobile, togglePane: () => {}, showPane: () => {}, showMap: () => {} }}>
    <PaneToggles />
  </PanesProvider>
);

const pressed = (html: string, label: string) =>
  new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0].includes('aria-pressed="true"');

describe('PaneToggles', () => {
  it('offers the four panes, showing which are open', () => {
    const html = render({ api: false, request: true, map: false, response: true }, false);
    expect(pressed(html, 'API')).toBe(false);
    expect(pressed(html, 'Request')).toBe(true);
    expect(pressed(html, 'Map')).toBe(false);
    expect(pressed(html, 'Response')).toBe(true);
  });

  it('shows the one pane showing on a phone', () => {
    const html = render({ api: true, request: false, map: false, response: false }, true);
    expect(pressed(html, 'API')).toBe(true);
    expect(pressed(html, 'Request')).toBe(false);
    expect(pressed(html, 'Map')).toBe(false);
    expect(pressed(html, 'Response')).toBe(false);
  });
});
