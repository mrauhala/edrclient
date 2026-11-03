import Button from '@mui/material/Button';
import MapIcon from '@mui/icons-material/Map';
import ViewListIcon from '@mui/icons-material/ViewList';
import { useSidebar } from './contexts/SidebarContext';

// On phones the sidebar covers the map. This switches between the two, and tells users there is a map
export default function MapListToggle() {
  const { sidebarOpen, isMobile, toggleSidebar } = useSidebar();
  if (!isMobile) return null;
  return (
    <Button
      variant="outlined"
      onClick={toggleSidebar}
      startIcon={sidebarOpen ? <MapIcon /> : <ViewListIcon />}
      aria-controls="sidebar"
      sx={{ flexShrink: 0 }}
    >
      {sidebarOpen ? 'Map' : 'List'}
    </Button>
  );
}
