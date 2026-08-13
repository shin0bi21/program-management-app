import { useMemo, useState } from 'react';
import Button from '../../../../../../common/components/Button/Button';
import Modal from '../../../../../../common/components/Modal/Modal';
import { dayKey } from '../../../../../../common/components/ResourceCalendar/periods/periods';
import type { Task } from '../../../../../../common/features/tasks/types';
import { groupTasksForOverview } from '../../../taskOverview';
import '../../../../../../common/components/DashboardCard/DashboardCard.css';
import './TaskOverviewDashboardCard.css';

const compactDateFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });

function formatCompactDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return compactDateFormatter.format(new Date(year, month - 1, day, 12));
}

function TaskDueList({ title, tasks, emptyMessage, tone = 'neutral', dueThisWeekIds }: {
  title: string;
  tasks: readonly Task[];
  emptyMessage: string;
  tone?: 'neutral' | 'danger';
  dueThisWeekIds?: ReadonlySet<string>;
}) {
  return <section className={`task-overview-card__task-section task-overview-card__task-section--${tone}`}>
    <h3>{title}</h3>
    {tasks.length ? <ul>
      {tasks.map(task => <li
        key={task.id}
        className={dueThisWeekIds?.has(task.id) ? 'task-overview-card__task--due-this-week' : undefined}
      >
        <strong>{task.title}</strong>
        <span>{formatCompactDate(task.dueDate)}</span>
      </li>)}
    </ul> : <p>{emptyMessage}</p>}
  </section>;
}

export default function TaskOverviewDashboardCard({ tasks, resourceName }: {
  tasks: readonly Task[];
  resourceName: string;
}) {
  const [open, setOpen] = useState(false);
  const overview = useMemo(() => groupTasksForOverview(tasks, dayKey(new Date())), [tasks]);
  const summary = {
    assigned: overview.activeTasks.length,
    overdue: overview.overdueTasks.length,
    upcoming: overview.upcomingTasks.length,
  };
  const dueThisWeekIds = new Set(overview.dueThisWeekTasks.map(task => task.id));

  return <>
    <article className="dashboard-card task-overview-card">
      <h2 className="task-overview-card__accessible-title">Task Overview</h2>
      <div className="dashboard-card__compact-layout task-overview-card__layout">
        <dl className="task-overview-card__metrics">
          <div><dt>Tasks Assigned</dt><dd>{summary.assigned}</dd></div>
          <div className="task-overview-card__metric-overdue"><dt>Overdue</dt><dd>{summary.overdue}</dd></div>
          <div><dt>Upcoming</dt><dd>{summary.upcoming}</dd></div>
        </dl>
        <div className="dashboard-card__compact-action task-overview-card__action">
          <Button
            size="sm"
            variant="secondary"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >See Breakdown</Button>
        </div>
      </div>
    </article>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={resourceName} maxWidth="560px">
      <dl className="task-overview-card__report" aria-label="Task summary">
        <div><dt>Assigned</dt><dd>{summary.assigned}</dd></div>
        <div className="task-overview-card__report-overdue"><dt>Overdue</dt><dd>{summary.overdue}</dd></div>
        <div><dt>Upcoming</dt><dd>{summary.upcoming}</dd></div>
      </dl>
      <div className="task-overview-card__task-lists">
        <TaskDueList title="Overdue" tasks={overview.overdueTasks} emptyMessage="No overdue tasks." tone="danger" />
        <TaskDueList
          title="Upcoming"
          tasks={overview.upcomingTasks}
          emptyMessage="No upcoming tasks."
          dueThisWeekIds={dueThisWeekIds}
        />
      </div>
    </Modal>
  </>;
}
