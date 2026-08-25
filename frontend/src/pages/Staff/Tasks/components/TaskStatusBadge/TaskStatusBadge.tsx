import type { Task } from '../../types';
import './TaskStatusBadge.css';

export default function TaskStatusBadge({ task }: { task: Task }) {
  return <span className={`task-status-badge task-status-badge--${task.status}`}>{task.statusLabel}</span>;
}
