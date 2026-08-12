import type { Task } from '../../../../../common/features/tasks/types';
import TaskHoursLoggedCard from './TaskHoursLoggedCard/TaskHoursLoggedCard';
import TaskOverviewCard from './TaskOverviewCard/TaskOverviewCard';

interface TaskDashboardProps {
  tasks: readonly Task[];
  resourceName: string;
  selectedTask: Task | null;
  onLogHours?: () => void;
}

export default function TaskDashboard({ tasks, resourceName, selectedTask, onLogHours }: TaskDashboardProps) {
  return <>
    <TaskOverviewCard tasks={tasks} resourceName={resourceName} />
    <TaskHoursLoggedCard task={selectedTask} onLogHours={onLogHours} />
  </>;
}
