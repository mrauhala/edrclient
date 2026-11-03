import { createContext, useContext, useState, useMemo, useCallback } from 'react';

interface SidebarContextValue {
  sidebarOpen: boolean;
  // Below the md breakpoint the sidebar covers the map instead of sitting beside it
  isMobile: boolean;
  toggleSidebar: () => void;
  // Shows the map when the next step happens there. Only phones need this: on desktop it's always visible
  showMap: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const SidebarProvider = SidebarContext.Provider;

// The sidebar's state, owned by AppContent (which also handles its keyboard shortcut) and provided with SidebarProvider
export function useSidebarState(isMobile: boolean): SidebarContextValue {
  // Open at start, also on phones: the service and collection are chosen there
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(open => !open);
  }, []);

  const showMap = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  return useMemo(() => ({ sidebarOpen, isMobile, toggleSidebar, showMap }), [sidebarOpen, isMobile, toggleSidebar, showMap]);
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
