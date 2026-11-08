import type { Task } from '../../types';
import { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard/TaskOverviewDashboardCard';

interface TaskDashboardProps {
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
 * @param props - staff selection, selected saved task, and permitted actions.
 * @example <TaskDashboard {...dashboardProps} />
 */
export default function TaskDashboard({
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
      queryKey={queryKey}
      resourceId={resourceId}
      resourceName={resourceName}
      today={today}
      onMessageChange={onMessageChange}
    />
    <TaskHoursLoggedDashboardCard task={selectedTask} onLogHours={onLogHours} />
  </>;
}
