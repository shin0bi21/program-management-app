import type { Task } from '../../types';
import { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard/TaskOverviewDashboardCard';

interface TaskDashboardProps {
  records: Readonly<Record<string, Task>>;
  queryKey: readonly unknown[];
  resourceId: string;
  resourceName: string;
  today: string;
  selectedTask: Task | null;
  onLogHours?: () => void;
  onMessageChange?: PageMessageChangeHandler;
}

/**
 * Composes staff overview queries and the selected task's already loaded hours.
 * @param props - Main records, staff selection, selected saved task, and permitted actions.
 * @example <TaskDashboard records={records} {...dashboardProps} />
 */
export default function TaskDashboard({
  records,
  queryKey,
  resourceId,
  resourceName,
  today,
  selectedTask,
  onLogHours,
  onMessageChange,
}: TaskDashboardProps) {
  return <>
    <TaskOverviewDashboardCard
      records={records}
      queryKey={queryKey}
      resourceId={resourceId}
      resourceName={resourceName}
      today={today}
      onMessageChange={onMessageChange}
    />
    <TaskHoursLoggedDashboardCard task={selectedTask} onLogHours={onLogHours} />
  </>;
}
