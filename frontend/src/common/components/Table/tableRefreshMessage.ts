import type { PageMessageItem } from '../PageMessageOverlay/PageMessageOverlay';

export default function tableRefreshMessage(notice?: { refreshing: boolean; onRefresh: () => void } | null): PageMessageItem | undefined {
  if (!notice) return undefined;

  return {
    severity: 'warning',
    message: 'This table’s data is out of order.',
    tooltip: 'Edited rows stay in place while you work. Refresh when you’re ready to restore the sort order.',
    action: { label: 'Refresh', onClick: notice.onRefresh, disabled: notice.refreshing },
  };
}
