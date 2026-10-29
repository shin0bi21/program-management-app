import { useEffect, useState } from 'react';
import Button from '../../../../../../common/components/Button/Button';
import Modal from '../../../../../../common/components/Modal/Modal';
import { formatHours, formatShortDate } from '../../../../../../common/utils/date';
import type { Task } from '../../../types';
import '../../../../../../common/components/DashboardCard/DashboardCard.css';
import './TaskHoursLoggedDashboardCard.css';

export default function TaskHoursLoggedDashboardCard({ task, onLogHours }: {
  task: Task | null;
  onLogHours?: () => void;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  useEffect(() => setOpenTaskId(null), [task?.id]);
  const maxDailyHours = task ? Math.max(...task.loggedHoursByDate.map(entry => entry.hours), 1) : 1;
  return <>
    <article className="dashboard-card dashboard-card--short task-hours-breakdown-card">
      <h2 className="task-hours-breakdown__accessible-title">Hours Logged</h2>
      {task ? <>
        <div className="dashboard-card__compact-layout task-hours-breakdown__layout">
          <dl className="task-hours-breakdown__summary">
            <div><dt>Logged</dt><dd>{formatHours(task.hoursLogged)}</dd></div>
          </dl>
          <div className="dashboard-card__compact-action task-hours-breakdown__actions">
            {onLogHours && <Button size="sm" onClick={onLogHours}>Log Hours</Button>}
            <Button size="sm" variant="secondary" aria-haspopup="dialog" onClick={() => setOpenTaskId(task.id)}>See Breakdown</Button>
          </div>
        </div>
      </> : <p className="task-hours-breakdown__empty">Click a task to view its logged hours.</p>}
    </article>
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
