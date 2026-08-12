import { TASK_STATUS_LABELS, type TaskStatus } from '../../../../../common/features/tasks/types';
import './TaskStatusBadge.css';

export default function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`task-status-badge task-status-badge--${status}`}>{TASK_STATUS_LABELS[status]}</span>;
}
