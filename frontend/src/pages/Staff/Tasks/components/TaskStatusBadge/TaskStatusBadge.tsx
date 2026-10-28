import StatusBadge from '../../../../../common/components/StatusBadge/StatusBadge';
import type { Task } from '../../types';

export default function TaskStatusBadge({ task }: { task: Task }) {
  return <StatusBadge status={task.status} label={task.statusLabel} />;
}
