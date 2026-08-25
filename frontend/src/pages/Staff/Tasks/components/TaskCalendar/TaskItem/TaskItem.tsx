import CalendarItem from '../../../../../../common/components/ResourceCalendar/items/CalendarItem';
import { formatHours } from '../../../../../../common/utils/date';
import type { Task } from '../../../types';
import TaskStatusBadge from '../../TaskStatusBadge/TaskStatusBadge';
import './TaskItem.css';

export default function TaskItem({ task, selected = false, onComplete, onCancel, onReopen, onEdit, onDelete, onActivate }: { task: Task; selected?: boolean; onComplete?: () => void; onCancel?: () => void; onReopen?: () => void; onEdit?: () => void; onDelete?: () => void; onActivate?: () => void }) {
  const className = `task-item--${task.status}`;

  return <CalendarItem
    id={task.id}
    selected={selected}
    ariaLabel={`${task.title}, ${task.statusLabel}, ${task.startDate} to ${task.dueDate}`}
    summary={<>{task.title} · {task.categoryLabel}</>}
    detailTitle={(
      <span className="task-item__detail-title">
        <span>{task.title}</span>
        <span className="task-item__detail-badges">
          <TaskStatusBadge task={task} />
        </span>
      </span>
    )}
    details={[
      { label: 'Program', value: task.programName ?? '—' },
      { label: 'Category', value: task.categoryLabel },
      { label: 'Start', value: task.startDate, sectionStart: true },
      { label: 'End', value: task.dueDate },
      { label: 'Logged', value: formatHours(task.hoursLogged) },
      ...(task.details ? [{ label: 'Notes', value: task.details, multiline: true }] : []),
    ]}
    actions={[
      ...(onComplete ? [{ id: 'complete', label: 'Set Completed', onClick: onComplete }] : []),
      ...(onCancel ? [{ id: 'cancel', label: 'Set Cancelled', onClick: onCancel }] : []),
      ...(onReopen ? [{ id: 'reopen', label: 'Reopen task', onClick: onReopen }] : []),
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
    onActivate={onActivate}
    className={className}
  />;
}
