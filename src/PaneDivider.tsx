import type { KeyboardEvent, PointerEvent } from 'react';
import Box from '@mui/material/Box';
import { DIVIDER_WIDTH, clampResponseWidth } from './panes';

const KEY_STEP = 20;

interface PaneDividerProps {
  width: number;
  onChange: (width: number) => void;
}

// Between the map and the response pane: dragging it, or its arrow keys, sets the response pane's width
export default function PaneDivider({ width, onChange }: PaneDividerProps) {
  // The room the two panes beside this share
  const measure = (divider: HTMLElement) => {
    const left = divider.previousElementSibling?.getBoundingClientRect().left ?? 0;
    const right = divider.nextElementSibling?.getBoundingClientRect().right ?? 0;
    return { right, available: right - left };
  };

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const { right, available } = measure(e.currentTarget);
    onChange(clampResponseWidth(right - e.clientX, available));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const { available } = measure(e.currentTarget);
    onChange(clampResponseWidth(width + (e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP), available));
  };

  return (
    <Box
      role="separator"
      aria-label="Response pane width"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      tabIndex={0}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      sx={{
        flex: `0 0 ${DIVIDER_WIDTH}px`,
        cursor: 'col-resize',
        // A touch drag moves the divider instead of scrolling
        touchAction: 'none',
        backgroundColor: 'divider',
        outline: 'none',
        '&:hover, &:focus-visible': { backgroundColor: 'primary.main' },
      }}
    />
  );
}
