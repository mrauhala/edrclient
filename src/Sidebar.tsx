import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import CollectionPane from './CollectionPane';
import ServiceInfoPanel from './ServiceInfoPanel';
import ServiceSelector from './ServiceSelector';
import CollectionsList from './CollectionsList';
import { usePanes } from './contexts/PanesContext';
import { PINNED_ROW_ROOM, REQUEST_WIDTH, leftPaneOpen } from './panes';

// One of the panes that take turns on the left, on top of each other. Hidden rather than removed, so that it keeps
// its scroll position and everything in it. Inherits otherwise, since the place as a whole may be hidden.
function LeftPane({ id, label, shown, scrollPaddingTop = 0, children }: { id: string; label: string; shown: boolean; scrollPaddingTop?: number; children: ReactNode }) {
  const { isOpen, isMobile } = usePanes();
  // Alone it takes the room, since nothing else is showing
  const width = isMobile || (!isOpen.map && !isOpen.response) ? '100%' : REQUEST_WIDTH;
  return (
    <Paper
      id={id}
      component="section"
      aria-label={label}
      elevation={3}
      sx={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        visibility: shown ? 'inherit' : 'hidden',
        minWidth: isMobile ? '100vw' : REQUEST_WIDTH,
        width,
        overflowY: 'scroll',
        overflowX: 'hidden',
        // Scrolling past either end doesn't carry on to the page
        overscrollBehavior: 'contain',
        scrollPaddingTop: `${scrollPaddingTop}px`,
        // Clear of a notch in landscape: on the left, and on phones, where it's full width, on the right
        pl: 'var(--safe-left)',
        pr: isMobile ? 'var(--safe-right)' : 0,
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
      }}
      className="sidebar-scrollable"
    >
      {children}
    </Paper>
  );
}

const Sidebar = () => {
  const { isOpen, isMobile } = usePanes();
  const open = leftPaneOpen(isOpen);
  const sidebarWidth = isMobile || (!isOpen.map && !isOpen.response) ? '100%' : REQUEST_WIDTH;

  return (
    <Box
      id="sidebar"
      sx={{
        width: open ? sidebarWidth : 0,
        flexShrink: 0,
        // Hidden once closed, so its controls leave the tab order; it stays mounted to keep its state
        visibility: open ? 'visible' : 'hidden',
        transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1) 0ms, visibility 225ms',
        overflow: 'hidden',
        height: '100%',
        // On phones it covers the map, within the row between the bars
        ...(isMobile ? { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 1100 } : { position: 'relative' }),
      }}
    >
      <LeftPane id="api-pane" label="API" shown={isOpen.api}>
        <ServiceSelector />
        <ServiceInfoPanel />
        <CollectionsList />
      </LeftPane>
      <LeftPane id="request-pane" label="Request" shown={isOpen.request} scrollPaddingTop={PINNED_ROW_ROOM}>
        <CollectionPane />
      </LeftPane>
    </Box>
  );
};

export default Sidebar;
