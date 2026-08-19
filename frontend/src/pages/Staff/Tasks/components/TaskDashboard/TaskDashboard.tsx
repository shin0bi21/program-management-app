import type { Task } from '../../../../../common/features/tasks/types';
import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard/TaskOverviewDashboardCard';
import useTaskOverviewData from './hooks/useTaskOverviewData';

interface TaskDashboardProps {
  queryKey: readonly unknown[];
  resourceId: string;
  resourceName: string;
  today: string;
  selectedTask: Task | null;
  onLogHours?: () => void;
}

export default function TaskDashboard({
  queryKey,
  resourceId,
  resourceName,
  today,
  selectedTask,
  onLogHours,
}: TaskDashboardProps) {
  const overviewData = useTaskOverviewData(queryKey, resourceId);

  return <>
    {overviewData.error && <p className="form-error" role="alert">{overviewData.error}</p>}
    {overviewData.loading
      ? <article className="dashboard-card"><p role="status">Loading task overview…</p></article>
      : <TaskOverviewDashboardCard tasks={overviewData.tasks} resourceName={resourceName} today={today} />}
    <TaskHoursLoggedDashboardCard task={selectedTask} onLogHours={onLogHours} />
  </>;
}
