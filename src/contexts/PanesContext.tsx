import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { INITIAL_PANES, phonePaneFollowingCollection, phonePaneToggled, withCollectionFollowed, withPaneOpen, withPaneToggled, withPanesFitted } from '../panes';
import type { OpenPanes, Pane } from '../panes';

interface PanesContextValue {
  // Below the md breakpoint one pane shows at a time, with the API, the request and the response covering the map.
  // From it up, the open panes sit side by side
  isMobile: boolean;
  isOpen: OpenPanes;
  togglePane: (pane: Pane) => void;
  showPane: (pane: Pane) => void;
  // Shows the map when the next step happens there
  showMap: () => void;
}

const PanesContext = createContext<PanesContextValue | null>(null);

export const PanesProvider = PanesContext.Provider;

// The panes' state, owned by AppContent (which also handles their keyboard shortcuts) and provided with PanesProvider.
// openSerial is a new number per collection opened, which hasCollection alone wouldn't show when switching.
export function usePanesState(isMobile: boolean, allFit: boolean, hasCollection: boolean, openSerial: number): PanesContextValue {
  const [sideBySide, setSideBySide] = useState(INITIAL_PANES);
  // Where it starts, also on phones: the service and collection are chosen there
  const [phonePane, setPhonePane] = useState<Pane>('api');

  useEffect(() => setSideBySide(open => withPanesFitted(open, allFit)), [allFit]);

  // Only on a change: asking for the list, or for the request with nothing open, has to stick
  useEffect(() => {
    setSideBySide(open => withCollectionFollowed(open, hasCollection));
    setPhonePane(current => phonePaneFollowingCollection(current, hasCollection));
  }, [hasCollection, openSerial]);

  const togglePane = useCallback((pane: Pane) => {
    if (isMobile) setPhonePane(current => phonePaneToggled(current, pane, hasCollection));
    else setSideBySide(open => withPaneToggled(open, pane, allFit, hasCollection));
  }, [isMobile, allFit, hasCollection]);

  const showPane = useCallback((pane: Pane) => {
    setPhonePane(pane);
    setSideBySide(open => withPaneOpen(open, pane, allFit));
  }, [allFit]);

  const showMap = useCallback(() => showPane('map'), [showPane]);

  const isOpen = useMemo<OpenPanes>(() => (isMobile
    ? { api: phonePane === 'api', request: phonePane === 'request', map: phonePane === 'map', response: phonePane === 'response' }
    : sideBySide), [isMobile, phonePane, sideBySide]);

  return useMemo(() => ({ isMobile, isOpen, togglePane, showPane, showMap }), [isMobile, isOpen, togglePane, showPane, showMap]);
}

export function usePanes() {
  const context = useContext(PanesContext);
  if (!context) {
    throw new Error('usePanes must be used within a PanesProvider');
  }
  return context;
}
