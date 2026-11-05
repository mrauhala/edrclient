import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeEditedUrl } from '../query/requestUrl';
import { useCollection } from './CollectionContext';

interface RequestUrlContextValue {
  // What gets sent: the URL the form built, unless it was edited
  requestUrl: string;
  isEdited: boolean;
  editUrl: (text: string) => void;
  discardEdits: () => void;
}

const RequestUrlContext = createContext<RequestUrlContextValue | null>(null);

export { RequestUrlContext };

export function RequestUrlProvider({ children }: { children: ReactNode }) {
  const { collectionUrl } = useCollection();
  const [edited, setEdited] = useState<string | null>(null);

  // The form moved on: carry over what it changed, keeping the rest of what was typed
  const builtRef = useRef(collectionUrl);
  useEffect(() => {
    const previous = builtRef.current;
    if (previous === collectionUrl) return;
    builtRef.current = collectionUrl;
    setEdited(current => (current === null ? null : mergeEditedUrl(previous, collectionUrl, current)));
  }, [collectionUrl]);

  const editUrl = useCallback((text: string) => setEdited(text === collectionUrl ? null : text), [collectionUrl]);
  const discardEdits = useCallback(() => setEdited(null), []);

  const value = useMemo(() => ({
    requestUrl: edited ?? collectionUrl,
    isEdited: edited !== null,
    editUrl,
    discardEdits,
  }), [edited, collectionUrl, editUrl, discardEdits]);

  return <RequestUrlContext.Provider value={value}>{children}</RequestUrlContext.Provider>;
}

export function useRequestUrl() {
  const context = useContext(RequestUrlContext);
  if (!context) throw new Error('useRequestUrl must be used within a RequestUrlProvider');
  return context;
}
