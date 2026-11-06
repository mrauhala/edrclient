import { useEffect, useState } from 'react';
import { parsePaneWidth } from '../panes';

// A pane's preferred width, remembered in the browser
export function useSavedPaneWidth(key: string, minWidth: number, fallback: number) {
  const [width, setWidth] = useState(() => parsePaneWidth(localStorage.getItem(key), minWidth, fallback));

  useEffect(() => {
    localStorage.setItem(key, String(width));
  }, [key, width]);

  return [width, setWidth] as const;
}
