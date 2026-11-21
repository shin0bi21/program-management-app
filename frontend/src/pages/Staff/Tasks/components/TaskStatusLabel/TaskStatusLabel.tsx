import type { ReactElement } from 'react';
import StatusLabel from '../../../../../common/components/StatusLabel/StatusLabel';
import type { Task } from '../../types';

interface TaskStatusLabelProps {
  task: Task;
}

/**
 * Displays a task's server-derived status and label.
 * @param props - Saved task containing the current display status.
 * @example <TaskStatusLabel task={task} />
 */
export default function TaskStatusLabel({ task }: TaskStatusLabelProps): ReactElement {
  return <StatusLabel status={task.status} label={task.statusLabel} />;
}
