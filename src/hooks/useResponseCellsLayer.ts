import { useCallback, useEffect, useRef, useState } from 'react';
import { Feature, Overlay } from 'ol';
import type OLMap from 'ol/Map';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { intersects, type Extent } from 'ol/extent';
import { Point, Polygon } from 'ol/geom';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import ImageCanvasSource from 'ol/source/ImageCanvas';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Stroke, Style } from 'ol/style';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useResponseCells, type CellsPicture } from '../contexts/responseCells';
import { opensAsPicture, sourceCell } from '../coverage/cellSelection';
import { lutFor, type Highlight, type RampKind } from '../coverage/colourScale';
import { invMercY, mercY, type DrawableCells } from '../coverage/coverageCells';
import { formatValue } from '../coverage/coverageSummary';
import { fullView, gridMaps, paintGrid, paintPolygons, paintSamples, type CellsPalette, type PlotView } from '../coverage/paintCells';
import { useCellsPalette } from '../coverage/useCellsPalette';
import { takesMapGeometry } from '../query/queryTypes';

// Web Mercator's metres in a degree of its x, and of the y that mercY gives
const METRES_PER_DEGREE = 20037508.342789244 / 180;
const POINT_HIT_PIXELS = 22;
// Above the base map's bottom layer, and under what the layer manager numbers from 1, such as the area asked for
const LAYER_Z = 0;
const MARK_Z = 9000;

export interface Drawn {
  picture: CellsPicture;
  ramp: RampKind;
  lit: Highlight | null;
  palette: CellsPalette;
}

export function paintOnMap(canvas: HTMLCanvasElement, { picture, ramp, lit, palette }: Drawn, extent: Extent, ratio: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { cells, codes } = picture;
  const g = cells.geometry;
  const W = canvas.width;
  const H = canvas.height;
  const v: PlotView = { x0: extent[0] / METRES_PER_DEGREE, x1: extent[2] / METRES_PER_DEGREE, y0: extent[3] / METRES_PER_DEGREE, y1: extent[1] / METRES_PER_DEGREE };
  const lut = lutFor(ramp, palette.mode, lit);
  if (g.kind === 'grid') {
    const maps = gridMaps(g, v, W, H);
    paintGrid(ctx, 0, 0, W, H, g, codes, lut, maps, { scale: ratio, mode: palette.mode, highlight: lit, nullClear: true });
    const left = maps.ex[0];
    const top = maps.ey[0];
    const width = maps.ex[g.nx] - left;
    const height = maps.ey[g.ny] - top;
    // Gridlines from 8 px a cell
    if (width / g.nx >= 8 * ratio && height / g.ny >= 8 * ratio) {
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      for (let i = 0; i <= g.nx; i++) ctx.fillRect(Math.round(maps.ex[i]), Math.round(top), 1, Math.round(height));
      for (let j = 0; j <= g.ny; j++) ctx.fillRect(Math.round(left), Math.round(maps.ey[j]), Math.round(width), 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.lineWidth = 3 * ratio;
    ctx.strokeRect(left, top, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = ratio;
    ctx.strokeRect(left, top, width, height);
    return;
  }
  const box = { plotX: 0, plotY: 0, plotW: W / ratio, plotH: H / ratio, v };
  if (g.kind === 'samples') paintSamples(ctx, box, g, cells.crs, codes, lut, ratio, palette, null);
  else paintPolygons(ctx, box, g, cells.crs, codes, lut, ratio, palette, true);
}

// The cell under a place on the map
export function cellAt(cells: DrawableCells, [mapX, mapY]: number[], resolution: number): number | null {
  const g = cells.geometry;
  const x = mapX / METRES_PER_DEGREE;
  const y = mapY / METRES_PER_DEGREE;
  if (g.kind === 'grid') {
    let col = -1;
    let row = -1;
    for (let i = 0; i < g.nx; i++) {
      if (x >= g.xEdges[i] && x < g.xEdges[i + 1]) {
        col = i;
        break;
      }
    }
    for (let j = 0; j < g.ny; j++) {
      if (y <= g.yEdges[j] && y > g.yEdges[j + 1]) {
        row = j;
        break;
      }
    }
    return col < 0 || row < 0 ? null : row * g.nx + col;
  }
  if (g.kind === 'samples') {
    let best: number | null = null;
    let bestDistance = (POINT_HIT_PIXELS * resolution) ** 2;
    for (let i = 0; i < g.cells; i++) {
      const distance = ((g.xs[i] * METRES_PER_DEGREE - mapX) ** 2) + ((mercY(g.ys[i]) * METRES_PER_DEGREE - mapY) ** 2);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }
  const lat = invMercY(y);
  for (let i = 0; i < g.cells; i++) {
    let inside = false;
    for (let a = g.offsets[i], b = g.offsets[i + 1] - 1; a < g.offsets[i + 1]; b = a++) {
      const xa = g.pts[a * 2];
      const ya = g.pts[a * 2 + 1];
      const xb = g.pts[b * 2];
      const yb = g.pts[b * 2 + 1];
      if ((ya > lat) !== (yb > lat) && x < ((xb - xa) * (lat - ya)) / (yb - ya) + xa) inside = !inside;
    }
    if (inside) return i;
  }
  return null;
}

// A cell's outline on the map, and a mark at its middle, since a cell can be smaller than a pixel
export function markFeatures(cells: DrawableCells, cell: number): Feature[] {
  const g = cells.geometry;
  const toMap = (x: number, projectedY: number) => [x * METRES_PER_DEGREE, projectedY * METRES_PER_DEGREE];
  if (g.kind === 'grid') {
    const row = Math.floor(cell / g.nx);
    const col = cell - row * g.nx;
    const ring = [
      toMap(g.xEdges[col], g.yEdges[row]), toMap(g.xEdges[col + 1], g.yEdges[row]),
      toMap(g.xEdges[col + 1], g.yEdges[row + 1]), toMap(g.xEdges[col], g.yEdges[row + 1]), toMap(g.xEdges[col], g.yEdges[row]),
    ];
    return [new Feature(new Polygon([ring])), new Feature(new Point(toMap((g.xEdges[col] + g.xEdges[col + 1]) / 2, (g.yEdges[row] + g.yEdges[row + 1]) / 2)))];
  }
  if (g.kind === 'samples') return [new Feature(new Point(toMap(g.xs[cell], mercY(g.ys[cell]))))];
  const ring: number[][] = [];
  for (let k = g.offsets[cell]; k < g.offsets[cell + 1]; k++) ring.push(toMap(g.pts[k * 2], mercY(g.pts[k * 2 + 1])));
  return [new Feature(new Polygon([ring]))];
}

const MARK_STYLE = [
  new Style({ stroke: new Stroke({ color: 'rgba(0,0,0,.9)', width: 3 }), image: new CircleStyle({ radius: 5, stroke: new Stroke({ color: 'rgba(0,0,0,.9)', width: 3 }) }) }),
  new Style({ stroke: new Stroke({ color: '#fff', width: 1.5 }), image: new CircleStyle({ radius: 5, stroke: new Stroke({ color: '#fff', width: 1.5 }) }) }),
];

export function extentOf(cells: DrawableCells): Extent {
  const { x0, x1, y0, y1 } = fullView(cells);
  return [x0 * METRES_PER_DEGREE, y1 * METRES_PER_DEGREE, x1 * METRES_PER_DEGREE, y0 * METRES_PER_DEGREE];
}

export const canGoOnMap = (cells: DrawableCells) => cells.crs.geographic && opensAsPicture(cells);

// The latest response's cells as one map layer. It's one slot, not a stack, and it never moves the map: if the data's
// out of view, the bar offers to go there, since jumping by itself would hide an offset
export function useResponseCellsLayer(map: OLMap | null, mapShown: boolean) {
  const { picture, choices, choose, lit, hover } = useResponseCells();
  const { dataQuery } = useMapInteraction();
  const palette = useCellsPalette();
  const { ramp, onMap, opacity, pin, flip } = choices;
  const drawn = useRef<Drawn | null>(null);
  const layers = useRef<{ image: ImageLayer<ImageCanvasSource>; source: ImageCanvasSource; marks: VectorSource; overlay: Overlay; label: HTMLDivElement } | null>(null);
  const [outOfView, setOutOfView] = useState(false);
  const shows = !!picture && canGoOnMap(picture.cells) && onMap;

  useEffect(() => {
    if (!map) return undefined;
    const canvas = document.createElement('canvas');
    const source = new ImageCanvasSource({
      ratio: 1.25,
      interpolate: false,
      canvasFunction: (extent, _resolution, pixelRatio, size) => {
        canvas.width = Math.max(1, Math.round(size[0]));
        canvas.height = Math.max(1, Math.round(size[1]));
        if (drawn.current) paintOnMap(canvas, drawn.current, extent, pixelRatio);
        return canvas;
      },
    });
    const image = new ImageLayer({ source, zIndex: LAYER_Z, visible: false });
    image.set('layer', 'response-cells');
    const marks = new VectorSource();
    const markLayer = new VectorLayer({ source: marks, zIndex: MARK_Z, style: MARK_STYLE, updateWhileInteracting: true, updateWhileAnimating: true });
    markLayer.set('layer', 'response-cell-mark');
    const label = document.createElement('div');
    Object.assign(label.style, {
      background: 'rgba(0,0,0,.85)', color: '#fff', padding: '3px 7px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap', pointerEvents: 'none',
    });
    const overlay = new Overlay({ element: label, positioning: 'bottom-left', offset: [10, -10], stopEvent: false });
    map.addLayer(image);
    map.addLayer(markLayer);
    map.addOverlay(overlay);
    layers.current = { image, source, marks, overlay, label };
    return () => {
      map.removeLayer(image);
      map.removeLayer(markLayer);
      map.removeOverlay(overlay);
      layers.current = null;
    };
  }, [map]);

  // Nothing's painted for a map that's hidden: reopening shows the current state
  useEffect(() => {
    const now = layers.current;
    if (!now) return;
    drawn.current = picture && shows ? { picture, ramp, lit, palette } : null;
    now.image.setVisible(shows && mapShown);
    now.source.changed();
  }, [map, picture, ramp, lit, palette, shows, mapShown]);

  useEffect(() => {
    layers.current?.image.setOpacity(opacity);
  }, [map, opacity]);

  // The hover and the pin, wherever they were pointed at
  useEffect(() => {
    if (!picture || !shows) {
      layers.current?.marks.clear();
      layers.current?.overlay.setPosition(undefined);
      return undefined;
    }
    const { cells, parameter, slice } = picture;
    const update = () => {
      const now = layers.current;
      if (!now) return;
      const hovered = hover.get()?.cell ?? null;
      const cell = hovered ?? pin;
      now.marks.clear();
      if (cell === null) {
        now.overlay.setPosition(undefined);
        return;
      }
      const features = markFeatures(cells, cell);
      now.marks.addFeatures(features);
      const raw = parameter.rawAt(sourceCell(cells.geometry, cell, flip), slice).value;
      now.label.textContent = raw === null || raw === undefined ? 'null' : `${typeof raw === 'number' ? formatValue(raw) : JSON.stringify(raw)}${parameter.unit ? ` ${parameter.unit}` : ''}`;
      const point = features[features.length - 1].getGeometry();
      now.overlay.setPosition(point instanceof Point ? point.getCoordinates() : (point as Polygon).getInteriorPoint().getCoordinates());
    };
    update();
    return hover.subscribe(update);
  }, [picture, shows, pin, flip, hover]);

  useEffect(() => {
    if (!map || !picture || !shows) return undefined;
    const { cells } = picture;
    const onMove = (event: MapBrowserEvent) => {
      if (event.dragging) return;
      const cell = cellAt(cells, event.coordinate, map.getView().getResolution() ?? 1);
      hover.set(cell === null ? null : { cell, under: 1 });
    };
    // A click on the map already means something: it pins a cell only when the query isn't waiting for one
    const onClick = (event: MapBrowserEvent) => {
      if (takesMapGeometry(dataQuery)) return;
      const cell = cellAt(cells, event.coordinate, map.getView().getResolution() ?? 1);
      if (cell !== null) choose({ pin: cell === pin ? null : cell });
    };
    const viewport = map.getViewport();
    const onLeave = () => hover.set(null);
    map.on('pointermove', onMove);
    map.on('singleclick', onClick);
    viewport.addEventListener('pointerleave', onLeave);
    return () => {
      map.un('pointermove', onMove);
      map.un('singleclick', onClick);
      viewport.removeEventListener('pointerleave', onLeave);
    };
  }, [map, picture, shows, hover, dataQuery, pin, choose]);

  const cells = picture?.cells ?? null;
  useEffect(() => {
    if (!map || !cells || !shows || !mapShown) {
      setOutOfView(false);
      return undefined;
    }
    const check = () => {
      const size = map.getSize();
      if (size) setOutOfView(!intersects(map.getView().calculateExtent(size), extentOf(cells)));
    };
    check();
    map.on('moveend', check);
    return () => map.un('moveend', check);
  }, [map, cells, shows, mapShown]);

  const goToData = useCallback(() => {
    if (map && cells) map.getView().fit(extentOf(cells), { padding: [60, 60, 60, 60], duration: 300, size: map.getSize() });
  }, [map, cells]);

  return { shows: shows && mapShown, outOfView, goToData };
}
