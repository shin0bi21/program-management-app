import type { PageMessageItem } from '../PageMessageOverlay/PageMessageOverlay';

export default function tableRefreshMessage(notice?: { refreshing: boolean; onRefresh: () => void } | null): PageMessageItem | undefined {
  if (!notice) return undefined;

  return {
    severity: 'warning',
    message: 'This table’s data is out of order.',
    action: { label: 'Refresh', onClick: notice.onRefresh, disabled: notice.refreshing },
  };
}
