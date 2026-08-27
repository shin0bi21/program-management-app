import { useEffect, useMemo, useState } from 'react';

import './PageErrorOverlay.css';

export interface PageErrorItem {
  message: string;
  details?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type PageErrorValue = string | PageErrorItem | null | undefined | false;

interface PageErrorOverlayProps {
  errors: readonly PageErrorValue[];
}

export default function PageErrorOverlay({ errors }: PageErrorOverlayProps) {
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);
  const visibleErrors = useMemo(() => errors.reduce<PageErrorItem[]>((items, error) => {
    if (!error) return items;

    const item = typeof error === 'string' ? { message: error } : error;
    if (!items.some(current => current.message === item.message)) items.push(item);
    return items;
  }, []), [errors]);
  const signature = visibleErrors.length ? JSON.stringify(visibleErrors.map(error => [
    error.message,
    error.details ?? '',
    error.action?.label ?? '',
  ])) : '';

  useEffect(() => {
    if (!signature) setDismissedSignature(null);
  }, [signature]);

  if (!visibleErrors.length || signature === dismissedSignature) return null;

  return <div className="page-error-overlay" role="alert">
    <button
      type="button"
      className="page-error-overlay__close"
      aria-label="Dismiss page errors"
      onClick={() => setDismissedSignature(signature)}
    >×</button>
    {visibleErrors.length === 1
      ? <ErrorContent error={visibleErrors[0]} />
      : <ul>{visibleErrors.map(error => <li key={error.message}><ErrorContent error={error} /></li>)}</ul>}
  </div>;
}

function ErrorContent({ error }: { error: PageErrorItem }) {
  return <div className="page-error-overlay__content">
    <div>
      <span>{error.message}</span>
      {error.details && <details className="page-error-overlay__details">
        <summary>Details</summary>
        <p>{error.details}</p>
      </details>}
    </div>
    {error.action && <button
      type="button"
      className="page-error-overlay__action"
      onClick={error.action.onClick}
    >{error.action.label}</button>}
  </div>;
}
