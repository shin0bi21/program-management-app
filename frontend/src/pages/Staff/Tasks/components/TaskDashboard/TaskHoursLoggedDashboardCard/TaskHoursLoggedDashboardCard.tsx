import { useEffect, useState } from 'react';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Button from '../../../../../../common/components/Button/Button';
import Modal from '../../../../../../common/components/Modal/Modal';
import { formatHours, formatShortDate } from '../../../../../../common/utils/date';
import type { Task } from '../../../types';
import './TaskHoursLoggedDashboardCard.css';

/**
 * Displays the selected task’s logged hours and its daily breakdown dialog.
 * @param props - Loaded task context and the permitted logging action.
 * @example <TaskHoursLoggedDashboardCard task={task} onLogHours={openHours} />
 */
export default function TaskHoursLoggedDashboardCard({ task, onLogHours }: {
  task: Task | null;
  onLogHours?: () => void;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => setOpenTaskId(null), [task?.id]);

  const maxDailyHours = task ? Math.max(...task.loggedHoursByDate.map(entry => entry.hours), 1) : 1;

  return <>
    <DashboardCard
      title="Hours Logged"
      className="dashboard-card--short task-hours-breakdown-card"
      details={[{ label: 'Logged', value: task ? formatHours(task.hoursLogged) : null }]}
      action={<div className="task-hours-breakdown__actions">
        {onLogHours && <Button size="sm" disabled={!task} onClick={onLogHours}>Log Hours</Button>}
        <Button size="sm" variant="secondary" aria-haspopup="dialog" disabled={!task} onClick={() => task && setOpenTaskId(task.id)}>See Breakdown</Button>
      </div>}
    >
      {!task && <p className="task-hours-breakdown__empty">Click a task to view its logged hours.</p>}
    </DashboardCard>
    <Modal isOpen={Boolean(task) && openTaskId === task?.id} onClose={() => setOpenTaskId(null)} title={task?.title ?? 'Hours Logged'} maxWidth="520px">
      {task && <dl className="task-hours-breakdown__details">
        <div><dt>Start</dt><dd>{formatShortDate(task.startDate)}</dd></div>
        <div><dt>End</dt><dd>{formatShortDate(task.dueDate)}</dd></div>
        <div><dt>Logged</dt><dd>{formatHours(task.hoursLogged)}</dd></div>
      </dl>}
      <section className="task-hours-breakdown__section" aria-labelledby="task-hours-breakdown-title">
        <h3 id="task-hours-breakdown-title" className="task-hours-breakdown__subtitle">Hours breakdown</h3>
        {task?.loggedHoursByDate.length ? <dl className="task-hours-breakdown__list">
          {task.loggedHoursByDate.map(entry => <div key={entry.date}>
            <dt>{formatShortDate(entry.date)}</dt>
            <dd><progress max={maxDailyHours} value={entry.hours} aria-label={`${formatHours(entry.hours)} on ${formatShortDate(entry.date)}`} /><strong>{formatHours(entry.hours)}</strong></dd>
          </div>)}
        </dl> : <p className="task-hours-breakdown__empty">No hours recorded.</p>}
        {task && <div className="task-hours-breakdown__total"><span>Total</span><strong>{formatHours(task.hoursLogged)}</strong></div>}
      </section>
    </Modal>
  </>;
}
