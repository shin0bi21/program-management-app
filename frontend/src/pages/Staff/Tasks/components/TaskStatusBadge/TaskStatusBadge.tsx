import { TASK_LIST_STATUS_LABELS, type Task } from '../../../../../common/features/tasks/types';
import { getTaskListStatus } from '../../utils/taskDates';
import './TaskStatusBadge.css';

export default function TaskStatusBadge({ task, today }: { task: Task; today: string }) {
  const status = getTaskListStatus(task, today);
  return <span className={`task-status-badge task-status-badge--${status}`}>{TASK_LIST_STATUS_LABELS[status]}</span>;
}
