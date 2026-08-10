import { useEffect, useRef } from 'react';

const subscribers = new Set<() => void>();

const dismissOpenFloatingUi = () => {
  for (const dismiss of subscribers) dismiss();
};

const attachViewportListeners = () => {
  window.addEventListener('scroll', dismissOpenFloatingUi, { capture: true, passive: true });
  window.addEventListener('resize', dismissOpenFloatingUi, { passive: true });
};

const detachViewportListeners = () => {
  window.removeEventListener('scroll', dismissOpenFloatingUi, true);
  window.removeEventListener('resize', dismissOpenFloatingUi);
};

export default function useViewportDismissal(active: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!active) return undefined;
    const dismiss = () => onDismissRef.current();
    if (!subscribers.size) attachViewportListeners();
    subscribers.add(dismiss);

    return () => {
      subscribers.delete(dismiss);
      if (!subscribers.size) detachViewportListeners();
    };
  }, [active]);
}
