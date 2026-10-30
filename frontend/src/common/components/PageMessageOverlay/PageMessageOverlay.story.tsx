import { useState } from 'react';

import PageMessageOverlay from './PageMessageOverlay';

export function PageMessagesStory({ mixed = false }: { mixed?: boolean }) {
  const [refreshing, setRefreshing] = useState(false);
  return <div style={{ position: 'relative', height: 400 }}>
    <PageMessageOverlay messages={[
      mixed && { message: 'Could not load more records.', action: { label: 'Retry', onClick: () => undefined } },
      {
        message: 'This table’s data is out of order.',
        severity: 'warning',
        action: { label: 'Refresh', disabled: refreshing, onClick: () => setRefreshing(true) },
      },
    ]} />
  </div>;
}
