import type { ItemCalendarProps } from '../../../../../../common/components/TimelineCalendar/types';
import Item from '../../../../../../common/components/TimelineCalendar/components/Item/Item';
import { formatHours } from '../../../../../../common/utils/date';
import type { Task } from '../../../types';
import TaskStatusLabel from '../../TaskStatusLabel/TaskStatusLabel';
import './TaskItem.css';

export default function TaskItem<TRow, TItemData>({ calendar, task, selected = false, onComplete, onCancel, onReopen, onEdit, onDelete }: { calendar?: ItemCalendarProps<TRow, TItemData>; task: Task; selected?: boolean; onComplete?: () => void; onCancel?: () => void; onReopen?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const className = `task-item--${task.status}`;

  return <Item
    calendar={calendar}
    id={task.id}
    selected={selected}
    ariaLabel={`${task.title}, ${task.statusLabel}, ${task.startDate} to ${task.dueDate}`}
    summary={<>{task.title} · {task.categoryLabel}</>}
    detailTitle={(
      <span className="task-item__detail-title">
        <span>{task.title}</span>
        <span className="task-item__detail-labels">
          <TaskStatusLabel task={task} />
        </span>
      </span>
    )}
    details={[
      { label: 'Program', value: task.program ?? '—' },
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
    className={className}
  />;
}
