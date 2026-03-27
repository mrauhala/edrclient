import React, { useState, useEffect, useCallback } from 'react';
import type { ActiveTab, FilterField } from '../types';

interface UseSearchNavigationParams {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  query: string;
  filters: Set<FilterField>;
  resultCounts: { services: number; collections: number; items: number };
  itemsEnabled: boolean;
  onSelect: (index: number) => void;
  onClose: () => void;
}

interface UseSearchNavigationReturn {
  highlightedIndex: number;
  isKeyboardNav: boolean;
  setIsKeyboardNav: (v: boolean) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useSearchNavigation({
  activeTab,
  setActiveTab,
  query,
  filters,
  resultCounts,
  itemsEnabled,
  onSelect,
  onClose,
}: UseSearchNavigationParams): UseSearchNavigationReturn {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, activeTab, filters]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tabOrder: ActiveTab[] = itemsEnabled ? ['services', 'collections', 'items'] : ['services', 'collections'];
    const resultCount = resultCounts[activeTab];

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setIsKeyboardNav(true);
        if (resultCount > 0) {
          setHighlightedIndex(prev => (prev + 1) % resultCount);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsKeyboardNav(true);
        if (resultCount > 0) {
          setHighlightedIndex(prev => prev <= 0 ? resultCount - 1 : prev - 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onSelect(highlightedIndex);
        }
        break;
      case 'Tab':
        e.preventDefault();
        {
          const currentIdx = tabOrder.indexOf(activeTab);
          const nextIdx = e.shiftKey
            ? (currentIdx - 1 + tabOrder.length) % tabOrder.length
            : (currentIdx + 1) % tabOrder.length;
          setActiveTab(tabOrder[nextIdx]);
        }
        break;
    }
  }, [activeTab, resultCounts, itemsEnabled, highlightedIndex, onClose, onSelect, setActiveTab]);

  return {
    highlightedIndex,
    isKeyboardNav,
    setIsKeyboardNav,
    handleKeyDown,
  };
}
