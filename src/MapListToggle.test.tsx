import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MapListToggle from './MapListToggle';
import { SidebarProvider } from './contexts/SidebarContext';

const render = (sidebarOpen: boolean, isMobile: boolean) => renderToStaticMarkup(
  <SidebarProvider value={{ sidebarOpen, isMobile, toggleSidebar: () => {}, showMap: () => {} }}>
    <MapListToggle />
  </SidebarProvider>
);

describe('MapListToggle', () => {
  it('offers the map while the sidebar covers it on a phone', () => {
    expect(render(true, true)).toMatch(/<button[^>]*aria-controls="sidebar"[^>]*>.*Map<\/button>/);
  });

  it('offers the list back while the map is showing', () => {
    const html = render(false, true);
    expect(html).toMatch(/<button[^>]*>.*List<\/button>/);
    expect(html).not.toContain('Map<');
  });

  it("isn't there on desktop, where the map is beside the sidebar", () => {
    expect(render(true, false)).toBe('');
    expect(render(false, false)).toBe('');
  });
});
