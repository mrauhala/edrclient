import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeEditedUrl } from '../query/requestUrl';
import { useCollection } from './CollectionContext';

interface RequestUrlContextValue {
  // What gets sent: the URL the form built, unless it was edited
  requestUrl: string;
  isEdited: boolean;
  editUrl: (text: string) => void;
  discardEdits: () => void;
  // Show this URL and leave it alone while the form catches up with it, through steps that
  // go by way of other URLs (opening a link)
  pinUrl: (text: string) => void;
  unpinUrl: () => void;
}

const RequestUrlContext = createContext<RequestUrlContextValue | null>(null);

export { RequestUrlContext };

export function RequestUrlProvider({ children }: { children: ReactNode }) {
  const { collectionUrl } = useCollection();
  const [edited, setEdited] = useState<string | null>(null);

  // The form moved on: carry over what it changed, keeping the rest of what was typed
  const builtRef = useRef(collectionUrl);
  // State, not a ref: this effect runs after those of the components below it, so it has to see the
  // pin as it was for this render, even if one of them has just released it
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const previous = builtRef.current;
    if (previous === collectionUrl) return;
    builtRef.current = collectionUrl;
    if (pinned) return;
    setEdited(current => (current === null ? null : mergeEditedUrl(previous, collectionUrl, current)));
  }, [collectionUrl, pinned]);

  const editUrl = useCallback((text: string) => setEdited(text === collectionUrl ? null : text), [collectionUrl]);
  const discardEdits = useCallback(() => setEdited(null), []);
  const pinUrl = useCallback((text: string) => {
    setPinned(true);
    setEdited(text);
  }, []);
  const unpinUrl = useCallback(() => setPinned(false), []);

  const value = useMemo(() => ({
    requestUrl: edited ?? collectionUrl,
    isEdited: edited !== null && edited !== collectionUrl,
    editUrl,
    discardEdits,
    pinUrl,
    unpinUrl,
  }), [edited, collectionUrl, editUrl, discardEdits, pinUrl, unpinUrl]);

  return <RequestUrlContext.Provider value={value}>{children}</RequestUrlContext.Provider>;
}

export function useRequestUrl() {
  const context = useContext(RequestUrlContext);
  if (!context) throw new Error('useRequestUrl must be used within a RequestUrlProvider');
  return context;
}
