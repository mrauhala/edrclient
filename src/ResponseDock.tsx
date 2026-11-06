import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { usePanes } from './contexts/PanesContext';
import { useSavedPaneWidth } from './hooks/useSavedPaneWidth';
import PaneDivider from './PaneDivider';
import { DEFAULT_RESPONSE_WIDTH, MIN_MAP_WIDTH, MIN_RESPONSE_WIDTH } from './panes';

// Where the response pane sits. Hidden once closed, so its controls leave the tab order; it stays mounted to keep its state
export default function ResponseDock({ children }: { children: ReactNode }) {
  const { isOpen, isMobile } = usePanes();
  const [width, setWidth] = useSavedPaneWidth('responsePaneWidth', MIN_RESPONSE_WIDTH, DEFAULT_RESPONSE_WIDTH);

  const open = isOpen.response;
  const placement = isMobile
    // On phones it covers the map, within the row between the bars
    ? { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1100 } as const
    : !open ? { flex: '0 0 0px' }
      // Beside the map it gives way before the map does, and before the left pane, down to its minimum, so that a divider
      // follows the pointer: if the two gave way together, dragging one would change what the other gave up. Without the
      // map it takes the room
      : isOpen.map ? { flex: `0 1000 ${width}px`, minWidth: MIN_RESPONSE_WIDTH }
        : { flex: 1, minWidth: MIN_RESPONSE_WIDTH };

  return (
    <>
      {open && isOpen.map && !isMobile && (
        <PaneDivider
          side="right"
          label="Response pane width"
          width={width}
          minWidth={MIN_RESPONSE_WIDTH}
          minBeside={MIN_MAP_WIDTH}
          onChange={setWidth}
        />
      )}
      <Box
        id="response-pane"
        sx={{
          ...placement,
          height: '100%',
          overflow: 'hidden',
          visibility: open ? 'visible' : 'hidden',
          // Clear of a notch on the right in landscape
          pr: 'var(--safe-right)',
          pl: isMobile ? 'var(--safe-left)' : 0,
          backgroundColor: 'background.paper',
        }}
      >
        <Box sx={{ height: '100%', minWidth: isMobile ? 0 : MIN_RESPONSE_WIDTH }}>
          {children}
        </Box>
      </Box>
    </>
  );
}
