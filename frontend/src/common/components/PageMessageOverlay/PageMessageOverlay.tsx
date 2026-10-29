import { useEffect, useMemo, useState } from 'react';

import './PageMessageOverlay.css';

export interface PageMessageItem {
  message: string;
  severity?: 'error' | 'warning';
  details?: string;
  tooltip?: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

export type PageMessageValue = string | PageMessageItem | readonly PageMessageItem[] | null | undefined | false;

interface PageMessageOverlayProps {
  messages: readonly PageMessageValue[];
}

export default function PageMessageOverlay({ messages }: PageMessageOverlayProps) {
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);
  const visibleMessages = useMemo(() => {
    const items: PageMessageItem[] = [];
    for (const value of messages) {
      if (!value) continue;

      const group: readonly PageMessageItem[] = typeof value === 'string'
        ? [{ message: value }]
        : 'message' in value ? [value] : value;
      for (const item of group) {
        if (!item.message) continue;
        const severity = item.severity ?? 'error';
        if (!items.some(current => current.message === item.message && (current.severity ?? 'error') === severity)) {
          items.push(item);
        }
      }
    }
    return items;
  }, [messages]);
  const signature = visibleMessages.length ? JSON.stringify(visibleMessages.map(item => [
    item.severity ?? 'error', item.message, item.details ?? '', item.tooltip ?? '', item.action?.label ?? '',
  ])) : '';
  const hasError = visibleMessages.some(item => (item.severity ?? 'error') === 'error');

  useEffect(() => {
    if (!signature) setDismissedSignature(null);
  }, [signature]);

  if (!visibleMessages.length || signature === dismissedSignature) return null;

  return <div className={`page-message-overlay page-message-overlay--${hasError ? 'error' : 'warning'}`} role={hasError ? 'alert' : 'status'}>
    <button
      type="button"
      className="page-message-overlay__close"
      aria-label="Dismiss page messages"
      onClick={() => setDismissedSignature(signature)}
    >×</button>
    {visibleMessages.length === 1
      ? <MessageContent item={visibleMessages[0]} />
      : <ul>{visibleMessages.map(item => <li key={`${item.severity ?? 'error'}:${item.message}`}>
        <MessageContent item={item} />
      </li>)}</ul>}
  </div>;
}

function MessageContent({ item }: { item: PageMessageItem }) {
  return <div className={`page-message-overlay__content page-message-overlay__content--${item.severity ?? 'error'}`}>
    <div>
      <span>{item.message}</span>
      {item.tooltip && <span
        className="page-message-overlay__info"
        tabIndex={0}
        title={item.tooltip}
        aria-label={item.tooltip}
      >ⓘ</span>}
      {item.details && <details className="page-message-overlay__details">
        <summary>Details</summary>
        <p>{item.details}</p>
      </details>}
    </div>
    {item.action && <button
      type="button"
      className="page-message-overlay__action"
      disabled={item.action.disabled}
      onClick={item.action.onClick}
    >{item.action.label}</button>}
  </div>;
}
