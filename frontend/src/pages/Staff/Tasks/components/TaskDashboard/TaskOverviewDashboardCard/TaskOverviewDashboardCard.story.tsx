import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard';

export function TaskSummary() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(['gallery-tasks', 'overview', 'staff-1'], []);
    return queryClient;
  });

  return <QueryClientProvider client={client}>
    <div style={{ width: 'min(100%, 360px)' }}>
      <TaskOverviewDashboardCard queryKey={['gallery-tasks']} resourceId="staff-1" resourceName="Zoe Wilson" today="2026-10-01" />
    </div>
  </QueryClientProvider>;
}
