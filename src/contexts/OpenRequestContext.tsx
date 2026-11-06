import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isForCollection } from '../query/parseQueryUrl';
import { collectionIdOf, isJustCollection, requestFromHash, requestRoute } from '../query/requestLink';
import { useApi } from './ApiContext';
import { useCollection } from './CollectionContext';
import { useOpenCollection } from './OpenCollectionContext';
import { useQueryBuilder } from './QueryBuilderContext';
import { useRequestUrl } from './RequestUrlContext';

const STILL_THERE = 'The request is still here to send.';
const CANT_FOLLOW = `The form can't show all of this request, since the collection has no such query, instance or location. ${STILL_THERE}`;
const NO_API = `This request's API couldn't be loaded. ${STILL_THERE}`;

interface OpenRequestContextValue {
  // Take the app to where a request URL points, as a browser's address bar does: the form and map,
  // and another collection if need be. Another API replaces everything in the form, so only if asked to.
  openRequest: (url: string, options: { switchApi: boolean }) => void;
  // Why the form couldn't follow, if it couldn't
  note: string | null;
  clearNote: () => void;
}

const OpenRequestContext = createContext<OpenRequestContextValue | null>(null);

// A request on its way into the form, by the steps it needs: its API loads, its collection opens with
// its locations, and then the form and map take on the URL. A link in the address starts at the API,
// which ApiProvider starts on. None of this sends anything: a link can't, since it could come from
// anyone and requests go out with stored credentials.
type Stage = 'api' | 'collection' | 'opening' | 'query' | 'applying';

export function OpenRequestProvider({ children }: { children: ReactNode }) {
  const { collections, selectedCollection } = useCollection();
  const { openCollection } = useOpenCollection();
  const { apiUrl, status: apiStatus, loadApiOf } = useApi();
  const { applyRequestUrl } = useQueryBuilder();
  const { pinUrl, unpinUrl, editUrl } = useRequestUrl();
  const [link] = useState(() => requestFromHash(window.location.hash));
  const [opening, setOpening] = useState<{ url: string; stage: Stage } | null>(link ? { url: link, stage: 'api' } : null);
  const [note, setNote] = useState<string | null>(null);

  const finish = useCallback((message: string | null) => {
    setOpening(null);
    unpinUrl();
    setNote(message);
  }, [unpinUrl]);

  // Until the form has caught up, it's the link's URL that shows
  useEffect(() => {
    if (link) pinUrl(link);
  }, [link, pinUrl]);

  useEffect(() => {
    if (!opening) return;
    const { url, stage } = opening;
    if (stage === 'api') {
      if (apiStatus === 'loading') return;
      if (collections.length) setOpening({ url, stage: 'collection' });
      else finish(NO_API);
    } else if (stage === 'collection') {
      const id = collectionIdOf(url);
      if (id === null) {
        finish(null);
      } else if (String(selectedCollection?.id) === id) {
        setOpening({ url, stage: 'query' });
      } else {
        const collection = collections.find(candidate => String(candidate.id) === id);
        if (!collection) {
          finish(`This API has no collection "${id}". ${STILL_THERE}`);
        } else {
          setOpening({ url, stage: 'opening' });
          openCollection(collection).finally(() => {
            setOpening(current => (current?.url === url && current.stage === 'opening' ? { url, stage: 'query' } : current));
          });
        }
      }
    } else if (stage === 'query') {
      setOpening({ url, stage: 'applying' });
      if (isJustCollection(url)) {
        editUrl(url);
        finish(null);
      } else {
        applyRequestUrl(url, followed => finish(followed ? null : CANT_FOLLOW));
      }
    }
  }, [opening, apiStatus, collections, selectedCollection, openCollection, editUrl, applyRequestUrl, finish]);

  const openRequest = useCallback((url: string, { switchApi }: { switchApi: boolean }) => {
    if (opening?.url === url) return;
    if (selectedCollection && isForCollection(url, selectedCollection)) {
      setOpening(null);
      unpinUrl();
      applyRequestUrl(url, followed => setNote(followed ? null : CANT_FOLLOW));
      return;
    }
    const route = requestRoute(url, apiUrl);
    if (route === 'none' || (route === 'api' && !switchApi)) return;
    setNote(null);
    pinUrl(url);
    if (route === 'api') {
      setOpening({ url, stage: 'api' });
      loadApiOf(url);
    } else {
      setOpening({ url, stage: 'collection' });
    }
  }, [opening, selectedCollection, apiUrl, loadApiOf, applyRequestUrl, pinUrl, unpinUrl]);

  // A link pasted into this tab only changes the fragment. The address bar's own updates don't count.
  useEffect(() => {
    const onHashChange = () => {
      if (requestFromHash(window.location.hash)) window.location.reload();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const clearNote = useCallback(() => setNote(null), []);
  const value = useMemo(() => ({ openRequest, note, clearNote }), [openRequest, note, clearNote]);
  return <OpenRequestContext.Provider value={value}>{children}</OpenRequestContext.Provider>;
}

export function useOpenRequest() {
  const context = useContext(OpenRequestContext);
  if (!context) throw new Error('useOpenRequest must be used within an OpenRequestProvider');
  return context;
}
