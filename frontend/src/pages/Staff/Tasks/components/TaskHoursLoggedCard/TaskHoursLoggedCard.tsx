import { useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import { formatShortDate } from '../../../../../common/utils/date';
import type { Task } from '../../../../../common/features/tasks/types';
import './TaskHoursLoggedCard.css';

export default function TaskHoursLoggedCard({ task, onLogHours }: {
  task: Task | null;
  onLogHours?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const maxDailyHours = task ? Math.max(...task.loggedHoursByDate.map(entry => entry.hours), 1) : 1;
  return <>
    <DashboardCard
      title="Hours Logged"
      action={task ? <div className="task-hours-breakdown__actions">
        {onLogHours && <Button size="sm" onClick={onLogHours}>Log Hours</Button>}
        <Button size="sm" variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>See Breakdown</Button>
      </div> : undefined}
    >
      {task ? <dl className="task-hours-breakdown__summary">
        <div><dt>Task Start</dt><dd>{formatShortDate(task.startDate)}</dd></div>
        <div><dt>Hours Logged</dt><dd>{task.hoursLogged.toFixed(2)}</dd></div>
      </dl> : <p className="task-hours-breakdown__empty">Select a task to view its logged hours.</p>}
    </DashboardCard>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={task?.title ?? 'Hours Logged'} maxWidth="520px">
      {task && <dl className="task-hours-breakdown__details">
        <div><dt>Task Start Date</dt><dd>{formatShortDate(task.startDate)}</dd></div>
        <div><dt>Task Due Date</dt><dd>{formatShortDate(task.dueDate)}</dd></div>
        <div><dt>Hours Logged</dt><dd>{task.hoursLogged.toFixed(2)}</dd></div>
      </dl>}
      <p className="task-hours-breakdown__subtitle">Work by date</p>
      {task?.loggedHoursByDate.length ? <dl className="task-hours-breakdown__list">
        {task.loggedHoursByDate.map(entry => <div key={entry.date}>
          <dt>{formatShortDate(entry.date)}</dt>
          <dd><progress max={maxDailyHours} value={entry.hours} aria-label={`${entry.hours.toFixed(2)} hours on ${formatShortDate(entry.date)}`} /><strong>{entry.hours.toFixed(2)}</strong></dd>
        </div>)}
      </dl> : <p className="task-hours-breakdown__empty">No hours recorded.</p>}
      {task && <div className="task-hours-breakdown__total"><span>Total</span><strong>{task.hoursLogged.toFixed(2)}</strong></div>}
    </Modal>
  </>;
}
