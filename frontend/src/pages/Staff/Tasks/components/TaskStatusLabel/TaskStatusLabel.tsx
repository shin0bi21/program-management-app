import StatusLabel from '../../../../../common/components/StatusLabel/StatusLabel';
import type { Task } from '../../types';

export default function TaskStatusLabel({ task }: { task: Task }) {
  return <StatusLabel status={task.status} label={task.statusLabel} />;
}
