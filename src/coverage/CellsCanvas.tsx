import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useResponseCells } from '../contexts/responseCells';
import { useElementWidth } from '../hooks/useElementWidth';
import { sourceCell } from './cellSelection';
import { lutFor } from './colourScale';
import {
  clampView, gridMaps, hitTest, paintAxes, paintGrid, paintGridDetail, paintMarks, paintPolygons, paintSamples, plotLayout, scaleText,
  type PaintedPlot, type PlotView,
} from './paintCells';
import { useCellsPalette } from './useCellsPalette';

const SHORTEST_PICTURE = 240;
// The axis labels' room above and below the cells
const CANVAS_MARGINS = 30;
const READOUT_MARGIN = 12;
const ZOOM_ROW = 30;

// Two stacked canvases, so that pointing doesn't repaint the cells. The picture fits the pane, and zooms from there
export default function CellsCanvas({ readoutBelow }: { readoutBelow: boolean }) {
  const { picture, choices, choose, lit, hover } = useResponseCells();
  const palette = useCellsPalette();
  const [setWrap, width] = useElementWidth();
  const base = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const plot = useRef<PaintedPlot | null>(null);
  const [scale, setScale] = useState('');
  const [tallest, setTallest] = useState(SHORTEST_PICTURE);
  const { zoom, ramp, pin, flip } = choices;

  // As tall as it can be with the readout still in sight below it, since pointing is no use without that. Where the
  // words above leave too little room, as on a phone, it's the tallest that fits once they're scrolled away
  useLayoutEffect(() => {
    const canvas = base.current;
    const scroller = canvas?.closest<HTMLElement>('[data-cells-scroller]');
    if (!canvas || !scroller) return undefined;
    const measure = () => {
      const readout = readoutBelow ? (scroller.querySelector<HTMLElement>('[data-cell-readout]')?.offsetHeight ?? 0) + READOUT_MARGIN : READOUT_MARGIN;
      const above = canvas.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const fits = scroller.clientHeight - above - CANVAS_MARGINS - readout;
      setTallest(Math.round(fits >= SHORTEST_PICTURE ? fits : Math.max(SHORTEST_PICTURE, scroller.clientHeight - ZOOM_ROW - CANVAS_MARGINS - readout)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [picture?.cells, readoutBelow, flip]);

  const repaintMarks = useCallback(() => {
    if (over.current && plot.current && picture) paintMarks(over.current, plot.current, picture.cells, pin, hover.get()?.cell ?? null);
  }, [picture, pin, hover]);

  useLayoutEffect(() => {
    const canvas = base.current;
    const marks = over.current;
    if (!picture || !canvas || !marks || width <= 0) return;
    const { cells, codes, parameter, slice } = picture;
    const g = cells.geometry;
    const box = plotLayout(cells, width, zoom, tallest);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (const each of [canvas, marks]) {
      each.width = box.width * ratio;
      each.height = box.height * ratio;
      each.style.width = `${box.width}px`;
      each.style.height = `${box.height}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lut = lutFor(ramp, palette.mode, lit);
    const W = box.plotW * ratio;
    const H = box.plotH * ratio;
    const ox = box.plotX * ratio;
    const oy = box.plotY * ratio;
    ctx.fillStyle = palette.plot;
    ctx.fillRect(ox, oy, W, H);
    let maps = null;
    if (g.kind === 'grid') {
      maps = gridMaps(g, box.v, W, H);
      paintGrid(ctx, ox, oy, W, H, g, codes, lut, maps, { scale: ratio, mode: palette.mode, highlight: lit });
      paintGridDetail(ctx, box, g, maps, codes, lut, cell => parameter.rawAt(sourceCell(g, cell, flip), slice).value, ratio, palette);
    } else if (g.kind === 'samples') {
      paintSamples(ctx, box, g, cells.crs, codes, lut, ratio, palette, palette.plot);
    } else {
      paintPolygons(ctx, box, g, cells.crs, codes, lut, ratio, palette);
    }
    paintAxes(ctx, box, cells, ratio, palette, zoom !== null);
    plot.current = { box, maps, codes, scale: ratio };
    setScale(scaleText(plot.current, cells));
    repaintMarks();
  }, [picture, width, tallest, zoom, ramp, lit, flip, palette, repaintMarks]);

  useLayoutEffect(repaintMarks, [repaintMarks, pin]);
  useEffect(() => hover.subscribe(repaintMarks), [hover, repaintMarks]);

  const zoomAbout = useCallback((x: number, y: number, factor: number, from: PlotView) => {
    if (!plot.current || !picture) return;
    const { box } = plot.current;
    const partX = Math.max(0, Math.min(1, (x - box.plotX) / box.plotW));
    const partY = Math.max(0, Math.min(1, (y - box.plotY) / box.plotH));
    const w = (from.x1 - from.x0) / factor;
    const h = (from.y0 - from.y1) / factor;
    const centreX = from.x0 + (from.x1 - from.x0) * partX;
    const centreY = from.y0 - (from.y0 - from.y1) * partY;
    choose({ zoom: clampView(picture.cells, { x0: centreX - w * partX, x1: centreX + w * (1 - partX), y0: centreY + h * partY, y1: centreY - h * (1 - partY) }) });
  }, [picture, choose]);

  const zoomFromMiddle = (factor: number) => {
    if (!plot.current) return;
    const { box } = plot.current;
    zoomAbout(box.plotX + box.plotW / 2, box.plotY + box.plotH / 2, factor, box.v);
  };

  // A plain wheel scrolls the pane, which is taller than the picture. A pinch on a trackpad arrives with Ctrl held
  useEffect(() => {
    const canvas = over.current;
    if (!canvas) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (!plot.current) return;
      const at = canvas.getBoundingClientRect();
      zoomAbout(event.clientX - at.left, event.clientY - at.top, event.deltaY < 0 ? 1.25 : 0.8, plot.current.box.v);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAbout]);

  const pointers = useRef(new Map<number, [number, number]>());
  const gesture = useRef<{ dragged: boolean; startX: number; startY: number; view: PlotView | null; pinch: { distance: number; view: PlotView } | null }>({
    dragged: false, startX: 0, startY: 0, view: null, pinch: null,
  });

  const toCanvas = (event: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const at = event.currentTarget.getBoundingClientRect();
    return [event.clientX - at.left, event.clientY - at.top];
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, toCanvas(event));
    const now = gesture.current;
    now.dragged = false;
    now.startX = event.clientX;
    now.startY = event.clientY;
    now.view = plot.current?.box.v ?? null;
    if (pointers.current.size === 2 && plot.current) {
      const [a, b] = [...pointers.current.values()];
      now.pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), view: plot.current.box.v };
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!plot.current || !picture) return;
    const at = toCanvas(event);
    const now = gesture.current;
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, at);
      if (pointers.current.size === 2 && now.pinch) {
        const [a, b] = [...pointers.current.values()];
        zoomAbout((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(a[0] - b[0], a[1] - b[1]) / now.pinch.distance, now.pinch.view);
        now.dragged = true;
        return;
      }
      const dx = event.clientX - now.startX;
      const dy = event.clientY - now.startY;
      if (zoom && now.view && Math.hypot(dx, dy) > 4) {
        now.dragged = true;
        const { box } = plot.current;
        const { view } = now;
        const kx = (view.x1 - view.x0) / box.plotW;
        const ky = (view.y0 - view.y1) / box.plotH;
        choose({ zoom: clampView(picture.cells, { x0: view.x0 - dx * kx, x1: view.x1 - dx * kx, y0: view.y0 + dy * ky, y1: view.y1 + dy * ky }) });
        return;
      }
    }
    if (event.pointerType === 'touch' && !pointers.current.has(event.pointerId)) return;
    hover.set(hitTest(plot.current, picture.cells, at[0], at[1]));
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = null;
    if (gesture.current.dragged || !plot.current || !picture) return;
    const [x, y] = toCanvas(event);
    const hit = hitTest(plot.current, picture.cells, x, y);
    // A finger that lifts also leaves, which clears what it pointed at
    if (hit) choose({ pin: pin === hit.cell && event.pointerType !== 'touch' ? null : hit.cell });
  };

  const onPointerCancel = (event: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    gesture.current.pinch = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!picture) return;
    const g = picture.cells.geometry;
    if (event.key === 'Escape') {
      choose({ pin: null });
      return;
    }
    if (event.key === '+' || event.key === '=') {
      zoomFromMiddle(1.6);
      return;
    }
    if (event.key === '-') {
      zoomFromMiddle(0.625);
      return;
    }
    if (event.key === '0') {
      choose({ zoom: null });
      return;
    }
    const move = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[event.key];
    if (!move) return;
    event.preventDefault();
    // The readout follows the keys, wherever the pointer happens to rest
    hover.set(null);
    if (pin === null) {
      choose({ pin: g.kind === 'grid' ? Math.floor(g.ny / 2) * g.nx + Math.floor(g.nx / 2) : 0 });
    } else if (g.kind === 'grid') {
      const row = Math.floor(pin / g.nx);
      const col = pin - row * g.nx;
      choose({ pin: Math.max(0, Math.min(g.ny - 1, row + move[1])) * g.nx + Math.max(0, Math.min(g.nx - 1, col + move[0])) });
    } else {
      choose({ pin: Math.max(0, Math.min(g.cells - 1, pin + move[0] + move[1])) });
    }
  };

  if (!picture) return null;
  const small = { minWidth: 28, height: 26, px: 0.75, lineHeight: 1, textTransform: 'none' } as const;
  const nothingToDraw = picture.figures.numbers === 0;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.75, pb: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '17px', color: 'text.secondary' }}>{scale}</Box>
        <Button size="small" variant="outlined" color="inherit" aria-label="Zoom in" onClick={() => zoomFromMiddle(1.6)} sx={small}>+</Button>
        <Button size="small" variant="outlined" color="inherit" aria-label="Zoom out" disabled={!zoom} onClick={() => zoomFromMiddle(0.625)} sx={small}>−</Button>
        <Button size="small" variant="outlined" color="inherit" disabled={!zoom} onClick={() => choose({ zoom: null })} sx={small}>Fit</Button>
      </Box>
      <Box ref={setWrap} sx={{ position: 'relative', mx: 1.75 }}>
        <canvas ref={base} style={{ display: 'block' }} />
        <canvas
          ref={over}
          tabIndex={0}
          role="img"
          aria-label={`${picture.parameter.id}, ${picture.cells.cells} cells. Arrow keys move between cells, and the value shows below`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => hover.set(null)}
          onKeyDown={onKeyDown}
          style={{ position: 'absolute', left: 0, top: 0, cursor: zoom ? 'grab' : 'crosshair', touchAction: zoom ? 'none' : 'pan-y', outlineOffset: -2 }}
        />
        {nothingToDraw && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', fontSize: '0.875rem', color: 'text.secondary' }}>
            All null
          </Box>
        )}
      </Box>
    </>
  );
}
