import { useLayoutEffect, useRef } from 'react';
import { useResponseCells } from '../contexts/responseCells';
import { codesFor } from './cellSelection';
import { lutFor } from './colourScale';
import type { CellParameter } from './coverageCells';
import { paintThumb } from './paintCells';
import { useCellsPalette } from './useCellsPalette';

// A parameter in small, so that an all-null one stands out at a glance, at this step and on its own range
export default function CellThumb({ parameter, width, height }: { parameter: CellParameter; width: number; height: number }) {
  const { picture } = useResponseCells();
  const palette = useCellsPalette();
  const canvas = useRef<HTMLCanvasElement>(null);
  const cells = picture?.cells;
  const slice = picture?.slice ?? 0;

  useLayoutEffect(() => {
    if (!canvas.current || !cells) return;
    const { lo, hi } = parameter.figures;
    paintThumb(canvas.current, cells, codesFor(parameter, cells, slice, lo, hi, 'none'), lutFor('sequential', palette.mode, null), width, height, Math.min(window.devicePixelRatio || 1, 2), palette);
  }, [cells, parameter, slice, width, height, palette]);

  return <canvas ref={canvas} aria-hidden style={{ display: 'block', flexShrink: 0, width, height }} />;
}
