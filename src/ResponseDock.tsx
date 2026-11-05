import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { usePanes } from './contexts/PanesContext';
import PaneDivider from './PaneDivider';
import { MIN_RESPONSE_WIDTH, parseResponseWidth } from './panes';

const WIDTH_KEY = 'responsePaneWidth';

// Where the response pane sits. Hidden once closed, so its controls leave the tab order; it stays mounted to keep its state
export default function ResponseDock({ children }: { children: ReactNode }) {
  const { isOpen, isMobile } = usePanes();
  const [width, setWidth] = useState(() => parseResponseWidth(localStorage.getItem(WIDTH_KEY)));

  useEffect(() => {
    localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);

  const open = isOpen.response;
  const placement = isMobile
    // On phones it covers the map, within the row between the menu and the bottom bar
    ? { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1100 } as const
    : !open ? { flex: '0 0 0px' }
      // Beside the map it gives way before the map does, down to its minimum; without the map it takes the room
      : isOpen.map ? { flex: `0 1 ${width}px`, minWidth: MIN_RESPONSE_WIDTH }
        : { flex: 1, minWidth: MIN_RESPONSE_WIDTH };

  return (
    <>
      {open && isOpen.map && !isMobile && <PaneDivider width={width} onChange={setWidth} />}
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
