import { useEffect } from 'react';
import { useCollection } from '../contexts/CollectionContext';
import { useOpenCollection } from '../contexts/OpenCollectionContext';

export function useCollectionKeyboardNav() {
  const { collections, selectedCollection } = useCollection();
  const { openCollection } = useOpenCollection();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;

      // Skip if focus is on an interactive element
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (collections.length === 0) return;

      // By the collection itself, since two can share an ID
      const currentIndex = selectedCollection ? collections.indexOf(selectedCollection) : -1;

      let newIndex: number;
      if (e.key === 'PageDown') {
        if (currentIndex >= collections.length - 1) return;
        newIndex = currentIndex + 1;
      } else {
        // PageUp
        if (currentIndex <= 0) return;
        newIndex = currentIndex - 1;
      }

      e.preventDefault();
      openCollection(collections[newIndex]);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collections, selectedCollection, openCollection]);
}
