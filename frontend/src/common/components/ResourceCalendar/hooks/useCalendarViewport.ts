import { useEffect, useState, type RefObject } from 'react';

export function useCalendarViewport(viewportRef: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);
  const [initialWidth, setInitialWidth] = useState<number | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      setHeight(viewport.clientHeight);
      if (viewport.clientWidth > 0) {
        setInitialWidth(current => current ?? viewport.clientWidth);
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewportRef]);

  return { height, initialWidth };
}
