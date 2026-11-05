import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { INITIAL_PANES, phonePaneToggled, withPaneOpen, withPaneToggled, withPanesFitted } from '../panes';
import type { OpenPanes, Pane } from '../panes';

interface PanesContextValue {
  // Below the md breakpoint one pane shows at a time, with the list and the response covering the map.
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

// The panes' state, owned by AppContent (which also handles their keyboard shortcuts) and provided with PanesProvider
export function usePanesState(isMobile: boolean, allFit: boolean): PanesContextValue {
  const [sideBySide, setSideBySide] = useState(INITIAL_PANES);
  // Open at start, also on phones: the service and collection are chosen there
  const [phonePane, setPhonePane] = useState<Pane>('request');

  useEffect(() => setSideBySide(open => withPanesFitted(open, allFit)), [allFit]);

  const togglePane = useCallback((pane: Pane) => {
    if (isMobile) setPhonePane(current => phonePaneToggled(current, pane));
    else setSideBySide(open => withPaneToggled(open, pane, allFit));
  }, [isMobile, allFit]);

  const showPane = useCallback((pane: Pane) => {
    setPhonePane(pane);
    setSideBySide(open => withPaneOpen(open, pane, allFit));
  }, [allFit]);

  const showMap = useCallback(() => showPane('map'), [showPane]);

  const isOpen = useMemo<OpenPanes>(() => (isMobile
    ? { request: phonePane === 'request', map: phonePane === 'map', response: phonePane === 'response' }
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
