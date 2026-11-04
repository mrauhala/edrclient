import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MapQueryOverlay, { type MapSelection } from './MapQueryOverlay';
import { SidebarProvider } from './contexts/SidebarContext';

const points: MapSelection = { title: 'Selected Points', items: ['Lat: 60°, Lon: 25°', 'Lat: 61°, Lon: 24°'] };

interface Options {
  hasGeometry?: boolean;
  isDrawing?: boolean;
  isMobile?: boolean;
  selection?: MapSelection;
  location?: { name: string; onInfo: () => void };
  onUndo?: () => void;
}

const render = (queryType: string, { hasGeometry = false, isDrawing = false, isMobile = false, selection = points, location, onUndo }: Options = {}) => renderToStaticMarkup(
  <SidebarProvider value={{ sidebarOpen: false, isMobile, toggleSidebar: () => {}, showMap: () => {} }}>
    <MapQueryOverlay queryType={queryType} hasGeometry={hasGeometry} isDrawing={isDrawing} onClear={() => {}} onUndo={onUndo} radiusLabel="10 km" selection={selection} location={location}>
      <input aria-label="Radius" />
    </MapQueryOverlay>
  </SidebarProvider>
);

describe('MapQueryOverlay', () => {
  it('asks for the geometry until the query has it', () => {
    const html = render('radius');
    expect(html).toContain('Click Points on Map');
    expect(html).toContain('Click to add multiple points with radius 10 km');
    expect(html).not.toContain('Clear Points');
    expect(html).not.toContain('Selected Points');
    expect(html).not.toContain('aria-label="Radius"');
  });

  it('keeps the prompt out of the middle of the map, and lets clicks through it', () => {
    const html = render('position');
    expect(html).toMatch(/<div style="[^"]*margin-left:10px[^"]*pointer-events:none[^"]*">/);
    expect(html).not.toContain('50%');
  });

  it('offers clearing a drawing that has not finished yet, clickable beside the prompt', () => {
    const html = render('trajectory', { isDrawing: true });
    expect(html).toContain('Draw Trajectory on Map');
    expect(html).toMatch(/<button style="[^"]*pointer-events:auto[^"]*">Clear Trajectory<\/button>/);
    expect(html).not.toContain('Selected Points');
    expect(html).not.toContain('aria-label="Radius"');
  });

  it('holds the selection, the clear button and the controls in one card once the query has its geometry', () => {
    const html = render('radius', { hasGeometry: true });
    expect(html).not.toContain('Click Points on Map');
    expect(html).toContain('Selected Points (2)');
    expect(html).toContain('1. Lat: 60°, Lon: 25°');
    expect(html).toContain('2. Lat: 61°, Lon: 24°');
    expect(html).toContain('Clear Points');
    expect(html).toContain('aria-label="Radius"');
    expect(html).toMatch(/<div style="[^"]*margin-left:10px[^"]*pointer-events:auto[^"]*">/);
    // Nothing floats off to another corner of the map
    expect(html).not.toContain('position:absolute');
  });

  it('collapses only the list on a phone, keeping the clear button and the controls', () => {
    const html = render('radius', { hasGeometry: true, isMobile: true });
    expect(html).toContain('Selected Points (2)');
    expect(html).not.toContain('Lat: 60°');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-controls');
    expect(html).toContain('Clear Points');
    expect(html).toContain('aria-label="Radius"');
  });

  it('points the header at the list it collapses', () => {
    const html = render('position', { hasGeometry: true });
    expect(html).toContain('aria-expanded="true"');
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
  });

  it('has only the clear button for a box, which lists nothing', () => {
    const html = render('cube', { hasGeometry: true, selection: { title: 'Selected Points', items: [] } });
    expect(html).toContain('Clear Box');
    expect(html).not.toContain('Selected Points');
    expect(html).not.toContain('Draw a Box on Map');
  });

  it('shows no prompt for an optional box, and nothing for queries without map input', () => {
    expect(render('items')).toBe('');
    expect(render('items', { isDrawing: true })).toContain('Clear Box');
    expect(render('locations')).toBe('');
    expect(render('metadata', { hasGeometry: true })).toBe('');
  });

  it('names the selected location, with its information a tap away and the clear button beside it', () => {
    const location = { name: 'Savukoski Tulppio', onInfo: () => {} };
    const html = render('locations', { hasGeometry: true, isMobile: true, selection: { title: 'Selected Points', items: [] }, location });
    expect(html).toMatch(/<button[^>]*aria-label="Location information: Savukoski Tulppio"[^>]*>.*Savukoski Tulppio<\/button>/);
    expect(html).toContain('Clear Location');
    expect(html).not.toContain('Selected Points');
  });

  it('shows no location card until one is selected', () => {
    const location = { name: 'Savukoski Tulppio', onInfo: () => {} };
    expect(render('locations', { location })).toBe('');
  });

  it('offers undo beside clear once the query has geometry', () => {
    const html = render('position', { hasGeometry: true, onUndo: () => {} });
    expect(html).toMatch(/<button style="[^"]*">Undo<\/button><button[^>]*>Clear Points<\/button>/);
  });

  it('offers undo during a drawing, clickable while the prompt beside it lets clicks through', () => {
    const html = render('area', { isDrawing: true, onUndo: () => {} });
    expect(html).toContain('Draw Areas on Map');
    expect(html).toMatch(/<button style="[^"]*pointer-events:auto[^"]*">Undo<\/button>/);
  });

  it('has nothing to undo before the first point', () => {
    expect(render('position', { onUndo: () => {} })).not.toContain('Undo');
  });

  it('has no undo for geometry that is one gesture', () => {
    const box = render('cube', { hasGeometry: true, selection: { title: 'Selected Points', items: [] } });
    expect(box).toContain('Clear Box');
    expect(box).not.toContain('Undo');
  });
});
