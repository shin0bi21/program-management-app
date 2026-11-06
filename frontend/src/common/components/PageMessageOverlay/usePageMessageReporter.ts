import { useEffect } from 'react';

import type { PageMessageItem, PageMessageValue } from './PageMessageOverlay';

export type PageMessageChangeHandler = (value: PageMessageValue) => void;

/**
 * Reports a child view's error and optional notice to the page, clearing the previous
 * report before changed inputs are reported and when the view unmounts.
 * @param onMessageChange - Updates this view's message slot in the page; keep the callback stable.
 * Omit it to disable reporting.
 * @param message - Error text; null or empty text clears the error without clearing a notice.
 * @param action - Error action, included only with a nonempty label and callback. The caller
 * owns the request and disabled state; keep action callbacks stable across unchanged renders.
 * @param notice - Additional message, such as a warning that edited rows are out of order.
 * @example usePageMessageReporter(onMessageChange, error, { label: 'Retry', onClick: retry });
 */
export default function usePageMessageReporter(
  onMessageChange: PageMessageChangeHandler | undefined,
  message: string | null,
  action?: PageMessageItem['action'],
  notice?: PageMessageItem | null,
) {
  const actionLabel = action?.label;
  const onAction = action?.onClick;
  const actionDisabled = action?.disabled;
  const noticeMessage = notice?.message;
  const noticeSeverity = notice?.severity;
  const noticeDetails = notice?.details;
  const noticeActionLabel = notice?.action?.label;
  const noticeOnAction = notice?.action?.onClick;
  const noticeActionDisabled = notice?.action?.disabled;

  useEffect(() => {
    if (!onMessageChange) return undefined;

    const items: PageMessageItem[] = [];
    if (message) {
      items.push({
        message,
        action: actionLabel && onAction ? {
          label: actionLabel,
          onClick: onAction,
          ...(actionDisabled === undefined ? {} : { disabled: actionDisabled }),
        } : undefined,
      });
    }

    if (noticeMessage) {
      items.push({
        message: noticeMessage,
        severity: noticeSeverity,
        details: noticeDetails,
        action: noticeActionLabel && noticeOnAction ? {
          label: noticeActionLabel,
          onClick: noticeOnAction,
          disabled: noticeActionDisabled,
        } : undefined,
      });
    }

    onMessageChange(items.length > 1 ? items : items[0] ?? null);
    return () => onMessageChange(null);
  }, [
    actionDisabled,
    actionLabel,
    message,
    onAction,
    onMessageChange,
    noticeMessage,
    noticeSeverity,
    noticeDetails,
    noticeActionLabel,
    noticeOnAction,
    noticeActionDisabled,
  ]);
}
