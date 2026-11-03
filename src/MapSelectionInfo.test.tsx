import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MapSelectionInfo from './MapSelectionInfo';
import { SidebarProvider } from './contexts/SidebarContext';

const render = (isMobile: boolean, footer?: string) => renderToStaticMarkup(
  <SidebarProvider value={{ sidebarOpen: false, isMobile, toggleSidebar: () => {}, showMap: () => {} }}>
    <MapSelectionInfo title="Selected Points" items={['Lat: 60°, Lon: 25°', 'Lat: 61°, Lon: 24°']} footer={footer} borderColor="white" />
  </SidebarProvider>
);

describe('MapSelectionInfo', () => {
  it('lists the selection on desktop, numbered, with its footer', () => {
    const html = render(false, 'Radius: 10 km');
    expect(html).toContain('Selected Points (2)');
    expect(html).toContain('1. Lat: 60°, Lon: 25°');
    expect(html).toContain('2. Lat: 61°, Lon: 24°');
    expect(html).toContain('Radius: 10 km');
    expect(html).toContain('aria-expanded="true"');
  });

  it('starts collapsed on a phone, where the list would cover the map', () => {
    const html = render(true, 'Radius: 10 km');
    expect(html).toContain('Selected Points (2)');
    expect(html).not.toContain('Lat: 60°');
    expect(html).not.toContain('Radius: 10 km');
    expect(html).toContain('aria-expanded="false"');
  });

  it('points its header at the list it collapses', () => {
    const html = render(false);
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });
});
