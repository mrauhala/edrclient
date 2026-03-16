import { useEffect } from 'react';
import { useCollection } from '../contexts/CollectionContext';

export function useCollectionKeyboardNav() {
  const { collections, selectedCollection, selectCollectionByIndexRef } = useCollection();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;

      // Skip if focus is on an interactive element
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (collections.length === 0) return;

      const currentIndex = selectedCollection
        ? collections.findIndex(c => c.id === selectedCollection.id)
        : -1;

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
      selectCollectionByIndexRef.current?.(newIndex);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collections, selectedCollection, selectCollectionByIndexRef]);
}
