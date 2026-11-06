import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import CollectionPane from './CollectionPane';
import ServiceInfoPanel from './ServiceInfoPanel';
import ServiceSelector from './ServiceSelector';
import CollectionsList from './CollectionsList';
import { usePanes } from './contexts/PanesContext';
import { useSavedPaneWidth } from './hooks/useSavedPaneWidth';
import PaneDivider from './PaneDivider';
import { DEFAULT_REQUEST_WIDTH, MIN_REQUEST_WIDTH, PINNED_ROW_ROOM, leftPaneOpen, minBesideLeftPane } from './panes';

// One of the panes that take turns on the left, on top of each other. Hidden rather than removed, so that it keeps
// its scroll position and everything in it. Inherits otherwise, since the place as a whole may be hidden.
function LeftPane({ id, label, shown, scrollPaddingTop = 0, children }: { id: string; label: string; shown: boolean; scrollPaddingTop?: number; children: ReactNode }) {
  const { isMobile } = usePanes();
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
        minWidth: isMobile ? '100vw' : MIN_REQUEST_WIDTH,
        width: '100%',
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
  const [width, setWidth] = useSavedPaneWidth('requestPaneWidth', MIN_REQUEST_WIDTH, DEFAULT_REQUEST_WIDTH);
  const open = leftPaneOpen(isOpen);
  const beside = isOpen.map || isOpen.response;

  const placement = isMobile
    // On phones it covers the map, within the row between the bars
    ? { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 1100, flexShrink: 0, width: open ? '100%' : 0 } as const
    : !open ? { position: 'relative', flex: '0 0 0px' } as const
      // Alone it takes the room, since nothing else is showing
      : !beside ? { position: 'relative', flex: 1 } as const
        : { position: 'relative', flex: `0 1 ${width}px`, minWidth: MIN_REQUEST_WIDTH } as const;

  return (
    <>
      <Box
        id="sidebar"
        sx={{
          ...placement,
          // Hidden once closed, so its controls leave the tab order; it stays mounted to keep its state
          visibility: open ? 'visible' : 'hidden',
          overflow: 'hidden',
          height: '100%',
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
      {open && beside && !isMobile && (
        <PaneDivider
          side="left"
          label={isOpen.api ? 'API pane width' : 'Request pane width'}
          width={width}
          minWidth={MIN_REQUEST_WIDTH}
          minBeside={minBesideLeftPane(isOpen)}
          onChange={setWidth}
        />
      )}
    </>
  );
};

export default Sidebar;
