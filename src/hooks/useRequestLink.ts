import { useCallback, useEffect, useRef, useState } from 'react';
import { useCollection } from '../contexts/CollectionContext';
import { useQueryBuilder } from '../contexts/QueryBuilderContext';
import { useRequestUrl } from '../contexts/RequestUrlContext';
import { collectionIdOf, isJustCollection, requestFromHash } from '../query/requestLink';

const STILL_THERE = "The link's request is still here to send.";

// Opening a link to a request: its API loads in place of the default (ServiceSelector), then its
// collection opens, with its locations, and then the form and map take on the URL. It only ever
// gets as far as being ready: a link can't send anything, since it could come from anyone and
// requests go out with stored credentials. A note says so if the form couldn't follow.
export function useRequestLink() {
  const { collections, selectCollectionByIndexRef } = useCollection();
  const { applyRequestUrl } = useQueryBuilder();
  const { pinUrl, unpinUrl, editUrl } = useRequestUrl();
  const [link] = useState(() => requestFromHash(window.location.hash));
  const [note, setNote] = useState<string | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const step = useRef<'api' | 'collection' | 'query' | 'done'>(link ? 'api' : 'done');

  const finish = useCallback((message: string | null) => {
    step.current = 'done';
    unpinUrl();
    setNote(message);
  }, [unpinUrl]);

  // Until the form has caught up, it's the link's URL that shows
  useEffect(() => {
    if (link) pinUrl(link);
  }, [link, pinUrl]);

  useEffect(() => {
    if (!link || step.current !== 'api' || collections.length === 0) return;
    const id = collectionIdOf(link);
    if (id === null) {
      finish(null);
      return;
    }
    const index = collections.findIndex(collection => String(collection.id) === id);
    if (index < 0) {
      finish(`This API has no collection "${id}", so the form is empty. ${STILL_THERE}`);
      return;
    }
    step.current = 'collection';
    Promise.resolve(selectCollectionByIndexRef.current?.(index)).finally(() => setCollectionOpen(true));
  }, [link, collections, selectCollectionByIndexRef, finish]);

  useEffect(() => {
    if (!link || !collectionOpen || step.current !== 'collection') return;
    step.current = 'query';
    if (isJustCollection(link)) {
      editUrl(link);
      finish(null);
      return;
    }
    applyRequestUrl(link, followed => finish(followed ? null : `The form can't show all of this request, since the collection has no such query, instance or location. ${STILL_THERE}`));
  }, [link, collectionOpen, editUrl, applyRequestUrl, finish]);

  // The API didn't load, so there's nothing to open
  const apiFailed = useCallback(() => {
    if (step.current === 'api') finish(`The link's API couldn't be loaded, so the form is empty. ${STILL_THERE}`);
  }, [finish]);

  // A link pasted into this tab only changes the fragment. The address bar's own updates don't count.
  useEffect(() => {
    const onHashChange = () => {
      if (requestFromHash(window.location.hash)) window.location.reload();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return { note, clearNote: useCallback(() => setNote(null), []), apiFailed };
}
