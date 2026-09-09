import type { Task } from '../../types';
import { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard/TaskOverviewDashboardCard';

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
  return <>
    <TaskOverviewDashboardCard
      queryKey={queryKey}
      resourceId={resourceId}
      resourceName={resourceName}
      today={today}
      onErrorChange={onErrorChange}
    />
    <TaskHoursLoggedDashboardCard task={selectedTask} onLogHours={onLogHours} />
  </>;
}
