import { useContext, useEffect, useId } from 'react';

import type { PageMessageItem, PageMessageValue } from './PageMessageOverlay';
import { PageMessageContext } from './pageMessageContext';

export type PageMessageChangeHandler = (value: PageMessageValue) => void;

/**
 * Reports a child view's error and optional notice, replacing its own report on changes
 * and clearing it on unmount. PageContainer collects reports automatically.
 * @param onMessageChange - Updates this view's message slot in the page; keep the callback stable.
 * An explicit callback overrides automatic reporting. Without either a callback or
 * a surrounding PageContainer, reporting is disabled.
 * @param message - Error text; null or empty text clears the error without clearing a notice.
 * @param action - Error action, included only with a nonempty label and callback. The caller
 * owns the request and disabled state; keep action callbacks stable across unchanged renders.
 * @param notice - Additional message, such as a warning that edited rows are out of order.
 * @example usePageMessageReporter(undefined, error, { label: 'Retry', onClick: retry }); // inside PageContainer
 * @example usePageMessageReporter(onMessageChange, error); // explicit destination outside PageContainer
 */
export default function usePageMessageReporter(
  onMessageChange: PageMessageChangeHandler | undefined,
  message: string | null,
  action?: PageMessageItem['action'],
  notice?: PageMessageItem | null,
) {
  const reportMessage = useContext(PageMessageContext);
  const source = useId();
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
    if (!onMessageChange && !reportMessage) return;

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

    const value = items.length > 1 ? items : items[0] ?? null;
    if (onMessageChange) onMessageChange(value);
    else reportMessage?.(source, value);
  }, [
    actionDisabled,
    actionLabel,
    message,
    onAction,
    onMessageChange,
    reportMessage,
    source,
    noticeMessage,
    noticeSeverity,
    noticeDetails,
    noticeActionLabel,
    noticeOnAction,
    noticeActionDisabled,
  ]);

  useEffect(() => () => {
    if (onMessageChange) onMessageChange(null);
    else reportMessage?.(source, null);
  }, [onMessageChange, reportMessage, source]);
}
