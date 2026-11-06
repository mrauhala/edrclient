import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import ServiceInfoPanel from './ServiceInfoPanel';
import ServiceSelector from './ServiceSelector';
import CollectionsList from './CollectionsList';
import { usePanes } from './contexts/PanesContext';
import { REQUEST_WIDTH } from './panes';

const Sidebar = () => {
  const { isOpen, isMobile } = usePanes();
  const open = isOpen.request;
  // Alone it takes the room, since nothing else is showing
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
      <Paper
        elevation={3}
        sx={{
          minWidth: isMobile ? '100vw' : REQUEST_WIDTH,
          width: sidebarWidth,
          height: '100%',
          overflowY: 'scroll',
          overflowX: 'hidden',
          // Scrolling past either end doesn't carry on to the page
          overscrollBehavior: 'contain',
          // Clear of a notch in landscape: on the left, and on phones, where it's full width, on the right
          pl: 'var(--safe-left)',
          pr: isMobile ? 'var(--safe-right)' : 0,
          borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        }}
        className="sidebar-scrollable"
      >
        <ServiceSelector />
        <ServiceInfoPanel />
        <CollectionsList />
      </Paper>
    </Box>
  );
};

export default Sidebar;
