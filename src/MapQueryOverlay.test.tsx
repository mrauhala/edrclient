import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MapQueryOverlay from './MapQueryOverlay';
import { SidebarProvider } from './contexts/SidebarContext';

const selection = { title: 'Selected Points', items: ['Lat: 60°, Lon: 25°'] };

const render = (queryType: string, hasGeometry: boolean, isDrawing = false) => renderToStaticMarkup(
  <SidebarProvider value={{ sidebarOpen: false, isMobile: false, toggleSidebar: () => {}, showMap: () => {} }}>
    <MapQueryOverlay queryType={queryType} hasGeometry={hasGeometry} isDrawing={isDrawing} onClear={() => {}} radiusLabel="10 km" selection={selection} />
  </SidebarProvider>
);

describe('MapQueryOverlay', () => {
  it('asks for the geometry until the query has it', () => {
    const html = render('radius', false);
    expect(html).toContain('Click Points on Map');
    expect(html).toContain('Click to add multiple points with radius 10 km');
    expect(html).not.toContain('Clear Points');
    expect(html).not.toContain('Selected Points');
  });

  it('keeps the prompt out of the middle of the map, and lets clicks through it', () => {
    const html = render('position', false);
    expect(html).toMatch(/style="[^"]*bottom:10px;left:10px[^"]*pointer-events:none[^"]*"><div[^>]*>Click Points on Map/);
    expect(html).not.toContain('50%');
  });

  it('lists the selection in the same corner, with the clear button, once the query has it', () => {
    const html = render('position', true);
    expect(html).not.toContain('Click Points on Map');
    expect(html).toMatch(/style="[^"]*bottom:10px;left:10px[^"]*">.*Selected Points/);
    expect(html).toContain('Lat: 60°, Lon: 25°');
    expect(html).toContain('Clear Points');
  });

  it('offers clearing a drawing that has not finished yet, still with the prompt', () => {
    const html = render('trajectory', false, true);
    expect(html).toContain('Draw Trajectory on Map');
    expect(html).toContain('Clear Trajectory');
    expect(html).not.toContain('Selected Points');
  });

  it('shows no prompt for an optional box, and nothing for queries without map input', () => {
    expect(render('items', false)).toBe('');
    expect(render('locations', false)).toBe('');
    expect(render('locations', true)).toBe('');
  });
});
