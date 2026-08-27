import { useEffect } from 'react';

import type { PageErrorItem } from './PageErrorOverlay';

export type PageErrorChangeHandler = (error: PageErrorItem | null) => void;

export default function usePageErrorReporter(
  onErrorChange: PageErrorChangeHandler | undefined,
  message: string | null,
  action?: PageErrorItem['action'],
) {
  const actionLabel = action?.label;
  const onAction = action?.onClick;

  useEffect(() => {
    if (!onErrorChange) return undefined;

    onErrorChange(message ? {
      message,
      action: actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined,
    } : null);
    return () => onErrorChange(null);
  }, [actionLabel, message, onAction, onErrorChange]);
}
