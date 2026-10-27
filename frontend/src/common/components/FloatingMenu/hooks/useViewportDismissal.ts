import { useEffect, useRef, type RefObject } from 'react';

const subscribers = new Set<(event: Event) => void>();

const dismissOpenFloatingUi = (event: Event) => {
  for (const dismiss of subscribers) dismiss(event);
};

const attachViewportListeners = () => {
  window.addEventListener('scroll', dismissOpenFloatingUi, { capture: true, passive: true });
  window.addEventListener('resize', dismissOpenFloatingUi, { passive: true });
};

const detachViewportListeners = () => {
  window.removeEventListener('scroll', dismissOpenFloatingUi, true);
  window.removeEventListener('resize', dismissOpenFloatingUi);
};

const isScrollWithin = (event: Event, element: HTMLElement | null | undefined) => (
  event.type === 'scroll'
  && event.target instanceof Node
  && element?.contains(event.target) === true
);

export default function useViewportDismissal(
  active: boolean,
  onDismiss: () => void,
  ignoreScrollWithinRef?: RefObject<HTMLElement | null>,
) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!active) return undefined;
    const dismiss = (event: Event) => {
      if (isScrollWithin(event, ignoreScrollWithinRef?.current)) return;

      onDismissRef.current();
    };
    if (!subscribers.size) attachViewportListeners();
    subscribers.add(dismiss);

    return () => {
      subscribers.delete(dismiss);
      if (!subscribers.size) detachViewportListeners();
    };
  }, [active, ignoreScrollWithinRef]);
}
