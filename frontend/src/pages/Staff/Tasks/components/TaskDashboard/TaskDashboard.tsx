import { useMemo } from 'react';
import type { Task } from '../../types';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard/TaskOverviewDashboardCard';
import useTaskOverviewData from './hooks/useTaskOverviewData';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

interface TaskDashboardProps {
  queryKey: readonly unknown[];
  resourceId: string;
  resourceName: string;
  today: string;
  selectedTask: Task | null;
  onLogHours?: () => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function TaskDashboard({
  queryKey,
  resourceId,
  resourceName,
  today,
  selectedTask,
  onLogHours,
  onErrorChange,
}: TaskDashboardProps) {
  const overviewData = useTaskOverviewData(queryKey, resourceId);
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: overviewData.retry }), [overviewData.retry]);
  usePageErrorReporter(onErrorChange, overviewData.error, retryAction);

  return <>
    {overviewData.loading
      ? <article className="dashboard-card"><p role="status">Loading task overview…</p></article>
      : overviewData.error
        ? <article className="dashboard-card"><UnavailableState compact title="Task overview unavailable" onRetry={overviewData.retry} /></article>
      : <TaskOverviewDashboardCard tasks={overviewData.tasks} resourceName={resourceName} today={today} />}
    <TaskHoursLoggedDashboardCard task={selectedTask} onLogHours={onLogHours} />
  </>;
}
