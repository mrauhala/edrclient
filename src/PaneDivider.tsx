import type { KeyboardEvent, PointerEvent } from 'react';
import Box from '@mui/material/Box';
import { DIVIDER_WIDTH, clampPaneWidth, widthStep } from './panes';

const KEY_STEP = 20;

interface PaneDividerProps {
  // Which side of the divider the pane it sizes is on
  side: 'left' | 'right';
  label: string;
  width: number;
  minWidth: number;
  // What the rest of the row, on the other side of the divider, keeps
  minBeside: number;
  onChange: (width: number) => void;
}

// Between two panes: dragging it, or its arrow keys, sets the width of the pane on one side
export default function PaneDivider({ side, label, width, minWidth, minBeside, onChange }: PaneDividerProps) {
  const measure = (divider: HTMLElement) => {
    const before = divider.previousElementSibling!.getBoundingClientRect();
    const after = divider.nextElementSibling!.getBoundingClientRect();
    return side === 'left'
      // Up to the end of the row, whatever's open in it. Not to the next pane, since a hidden map is out of the row's flow
      ? { edge: before.left, current: before.width, available: divider.parentElement!.getBoundingClientRect().right - before.left }
      : { edge: after.right, current: after.width, available: after.right - before.left };
  };

  const set = (next: number, available: number) => onChange(Math.round(clampPaneWidth(next, available, minWidth, minBeside)));

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const { edge, available } = measure(e.currentTarget);
    set(Math.abs(e.clientX - edge), available);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const step = widthStep(side, e.key, KEY_STEP);
    if (!step) return;
    e.preventDefault();
    // From the width it has, which can be less than the one it would like
    const { current, available } = measure(e.currentTarget);
    set(current + step, available);
  };

  return (
    <Box
      role="separator"
      aria-label={label}
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
