import { useLayoutEffect, useState } from 'react';

// How wide something is, following it as it changes. Zero until it's been measured
export function useElementWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!element) return;
    setWidth(element.offsetWidth);
    const observer = new ResizeObserver(() => setWidth(element.offsetWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width] as const;
}
