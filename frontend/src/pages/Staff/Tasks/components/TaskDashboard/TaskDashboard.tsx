import type { Task } from '../../../../../common/features/tasks/types';
import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard/TaskOverviewDashboardCard';

interface TaskDashboardProps {
  tasks: readonly Task[];
  resourceName: string;
  selectedTask: Task | null;
  onLogHours?: () => void;
}

export default function TaskDashboard({ tasks, resourceName, selectedTask, onLogHours }: TaskDashboardProps) {
  return <>
    <TaskOverviewDashboardCard tasks={tasks} resourceName={resourceName} />
    <TaskHoursLoggedDashboardCard task={selectedTask} onLogHours={onLogHours} />
  </>;
}
