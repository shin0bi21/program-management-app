import { useEffect, useMemo, useState } from 'react';

import './PageMessageOverlay.css';

export interface PageMessageItem {
  message: string;
  severity?: 'error' | 'warning';
  details?: string;
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

/**
 * Displays page errors and warnings with optional actions such as Retry or Refresh.
 * @param props.messages - Message text, detailed messages, or groups from different page areas.
 * Empty entries are ignored; the first item for each text/severity pair wins. The group
 * announces as an alert if any error is present, otherwise as status. Dismissal tracks
 * severity, text, details, and action labels; clearing all messages resets it. Callers
 * supply user-facing copy and handle action requests, failures, and pending state.
 * @example <PageMessageOverlay messages={[loadError, { message: 'Order changed', severity: 'warning', action: refreshAction }]} />
 */
export default function PageMessageOverlay({ messages }: PageMessageOverlayProps) {
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);
  const visibleMessages = useMemo(() => {
    const items: PageMessageItem[] = [];
    for (const value of messages) {
      if (!value) continue;

      let group: readonly PageMessageItem[];
      if (typeof value === 'string') {
        group = [{ message: value }];
      } else if ('message' in value) {
        group = [value];
      } else {
        group = value;
      }

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
    item.severity ?? 'error', item.message, item.details ?? '', item.action?.label ?? '',
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

/**
 * Renders one message's text, optional expandable details, and controlled action.
 * @param item - A message whose action callback and disabled state are controlled by the caller.
 * @example An item with action { label: 'Retry', onClick: retry } displays a Retry button.
 */
function MessageContent({ item }: { item: PageMessageItem }) {
  return <div className={`page-message-overlay__content page-message-overlay__content--${item.severity ?? 'error'}`}>
    <div>
      <span>{item.message}</span>
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
