import CalendarItem from '../../../../../../common/components/ResourceCalendar/items/CalendarItem';
import { TASK_CATEGORY_LABELS, TASK_LIST_STATUS_LABELS, type Task } from '../../../../../../common/features/tasks/types';
import { getTaskListStatus } from '../../../utils/taskDates';
import TaskStatusBadge from '../../TaskStatusBadge/TaskStatusBadge';
import './TaskItem.css';

export default function TaskItem({ task, today, selected = false, onComplete, onCancel, onReopen, onEdit, onDelete, onActivate }: { task: Task; today: string; selected?: boolean; onComplete?: () => void; onCancel?: () => void; onReopen?: () => void; onEdit?: () => void; onDelete?: () => void; onActivate?: () => void }) {
  const category = TASK_CATEGORY_LABELS[task.category];
  const status = getTaskListStatus(task, today);
  const statusLabel = TASK_LIST_STATUS_LABELS[status];
  const loggedHours = `${task.hoursLogged.toLocaleString('en-CA', { maximumFractionDigits: 2 })} ${task.hoursLogged === 1 ? 'hour' : 'hours'}`;
  const className = `task-item--${status}`;

  return <CalendarItem
    id={task.id}
    selected={selected}
    ariaLabel={`${task.title}, ${statusLabel}, ${task.startDate} to ${task.dueDate}`}
    summary={<>{task.title} · {category}</>}
    detailTitle={(
      <span className="task-item__detail-title">
        <span>{task.title}</span>
        <span className="task-item__detail-badges">
          <TaskStatusBadge task={task} today={today} />
        </span>
      </span>
    )}
    details={[
      { label: 'Program', value: task.programName ?? '—' },
      { label: 'Category', value: category },
      { label: 'Start', value: task.startDate, sectionStart: true },
      { label: 'End', value: task.dueDate },
      { label: 'Logged', value: loggedHours },
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
