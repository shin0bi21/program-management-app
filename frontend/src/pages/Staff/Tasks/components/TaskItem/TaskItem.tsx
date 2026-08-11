import type { ReactNode } from 'react';
import CalendarItem from '../../../../../common/components/ResourceCalendar/components/CalendarItem';
import { dayKey } from '../../../../../common/components/ResourceCalendar/periods';
import { TASK_CATEGORY_LABELS, TASK_STATUS_LABELS, type Task } from '../../../../../common/features/tasks/types';
import { isTaskOverdue } from '../../taskOverview';
import './TaskItem.css';

export default function TaskItem({ task, onComplete, onEdit, onDelete, onActivate }: { task: Task; onComplete?: () => void; onEdit?: () => void; onDelete?: () => void; onActivate?: () => void }) {
  const category = TASK_CATEGORY_LABELS[task.category];
  const overdue = isTaskOverdue(task, dayKey(new Date()));
  const completed = task.status === 'completed';
  const loggedHours = `${task.hoursLogged.toLocaleString('en-CA', { maximumFractionDigits: 2 })} ${task.hoursLogged === 1 ? 'hour' : 'hours'}`;
  let trailingStatus: ReactNode;
  if (completed) {
    trailingStatus = <strong className="task-item__completed" aria-label="Completed" title="Completed">✓</strong>;
  } else if (overdue) {
    trailingStatus = <strong className="task-item__overdue" aria-label="Overdue" title="Overdue">!</strong>;
  }
  return <CalendarItem
    id={task.id}
    ariaLabel={`${task.title}, ${task.startDate} to ${task.dueDate}`}
    summary={<>{task.title} · {category}</>}
    trailing={trailingStatus}
    detailTitle={(
      <span className="task-item__detail-title">
        <span>{task.title}</span>
        <span className="task-item__detail-badges">
          <span className={`task-item__status-badge task-item__status-badge--${task.status}`}>
            {TASK_STATUS_LABELS[task.status]}
          </span>
          {overdue && <span className="task-item__overdue-badge">Overdue</span>}
        </span>
      </span>
    )}
    details={[
      { label: 'Program', value: task.programName ?? 'General' },
      { label: 'Cycle', value: task.cycleName },
      { label: 'Category', value: category },
      { label: 'Start', value: task.startDate, sectionStart: true },
      { label: 'End', value: task.dueDate },
      { label: 'Logged', value: loggedHours },
      ...(task.details ? [{ label: 'Notes', value: task.details, multiline: true }] : []),
    ]}
    actions={onComplete ? [{ id: 'complete', label: 'Mark complete', onClick: onComplete }] : []}
    onEdit={onEdit}
    onDelete={onDelete}
    onActivate={onActivate}
  />;
}
