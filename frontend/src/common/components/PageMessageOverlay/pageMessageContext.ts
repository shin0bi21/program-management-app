import { createContext, useCallback, useState } from 'react';

import type { PageMessageValue } from './PageMessageOverlay';

type ReportPageMessage = (source: string, value: PageMessageValue) => void;

export const PageMessageContext = createContext<ReportPageMessage | undefined>(undefined);

/**
 * Collects independent child messages for one page without sharing state between pages.
 * @returns Current messages and a stable reporter; nullish values remove only their source.
 * @example reportMessage(cardId, null) // clears this card while retaining other reports
 */
export function usePageMessages() {
  const [messages, setMessages] = useState<Map<string, PageMessageValue>>(() => new Map());
  const reportMessage = useCallback<ReportPageMessage>((source, value) => {
    setMessages(current => {
      if (current.get(source) === value || (!value && !current.has(source))) return current;

      const next = new Map(current);
      if (value) next.set(source, value);
      else next.delete(source);
      return next;
    });
  }, []);

  return { messages: [...messages.values()], reportMessage };
}
