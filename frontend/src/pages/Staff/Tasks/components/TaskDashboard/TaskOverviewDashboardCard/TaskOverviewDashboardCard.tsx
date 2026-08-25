import { useMemo, useState } from 'react';
import Button from '../../../../../../common/components/Button/Button';
import Modal from '../../../../../../common/components/Modal/Modal';
import { dayKey } from '../../../../../../common/components/ResourceCalendar/periods/periods';
import type { Task } from '../../../types';
import '../../../../../../common/components/DashboardCard/DashboardCard.css';
import './TaskOverviewDashboardCard.css';

const compactDateFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function currentWeekEnd(today: string) {
  const date = parseCalendarDate(today);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday + 6);
  return dayKey(date);
}

function sortByDueDate(tasks: readonly Task[]) {
  return [...tasks].sort((left, right) => (
    left.dueDate.localeCompare(right.dueDate) || left.title.localeCompare(right.title)
  ));
}

function groupTasksForOverview(tasks: readonly Task[], today: string) {
  const assignedTasks = tasks.filter(task => task.state === 'open');
  const upcomingTasks = assignedTasks.filter(task => task.status === 'upcoming');
  const activeTasks = assignedTasks.filter(task => task.status === 'active');
  const overdueTasks = assignedTasks.filter(task => task.status === 'overdue');
  const weekEnd = currentWeekEnd(today);
  const dueThisWeekTasks = [...upcomingTasks, ...activeTasks]
    .filter(task => task.dueDate >= today && task.dueDate <= weekEnd);

  return {
    assignedTasks: sortByDueDate(assignedTasks),
    upcomingTasks: sortByDueDate(upcomingTasks),
    activeTasks: sortByDueDate(activeTasks),
    overdueTasks: sortByDueDate(overdueTasks),
    dueThisWeekTasks,
  };
}

function formatCompactDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return compactDateFormatter.format(new Date(year, month - 1, day, 12));
}

function TaskDueList({ title, tasks, emptyMessage, tone = 'neutral', dueThisWeekIds }: {
  title: string;
  tasks: readonly Task[];
  emptyMessage: string;
  tone?: 'neutral' | 'info' | 'warn' | 'danger';
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

export default function TaskOverviewDashboardCard({ tasks, resourceName, today }: {
  tasks: readonly Task[];
  resourceName: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const overview = useMemo(() => groupTasksForOverview(tasks, today), [tasks, today]);
  const summary = {
    assigned: overview.assignedTasks.length,
    upcoming: overview.upcomingTasks.length,
    active: overview.activeTasks.length,
    overdue: overview.overdueTasks.length,
  };
  const dueThisWeekIds = new Set(overview.dueThisWeekTasks.map(task => task.id));

  return <>
    <article className="dashboard-card task-overview-card">
      <h2 className="task-overview-card__accessible-title">Task Overview</h2>
      <div className="dashboard-card__compact-layout task-overview-card__layout">
        <dl className="task-overview-card__metrics">
          <div><dt>Assigned</dt><dd>{summary.assigned}</dd></div>
          <div className="task-overview-card__metric-upcoming"><dt>Upcoming</dt><dd>{summary.upcoming}</dd></div>
          <div className="task-overview-card__metric-active"><dt>Active</dt><dd>{summary.active}</dd></div>
          <div className="task-overview-card__metric-overdue"><dt>Overdue</dt><dd>{summary.overdue}</dd></div>
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
        <div className="task-overview-card__report-upcoming"><dt>Upcoming</dt><dd>{summary.upcoming}</dd></div>
        <div className="task-overview-card__report-active"><dt>Active</dt><dd>{summary.active}</dd></div>
        <div className="task-overview-card__report-overdue"><dt>Overdue</dt><dd>{summary.overdue}</dd></div>
      </dl>
      <div className="task-overview-card__task-lists">
        <TaskDueList
          title="Upcoming"
          tasks={overview.upcomingTasks}
          emptyMessage="No upcoming tasks."
          tone="info"
          dueThisWeekIds={dueThisWeekIds}
        />
        <TaskDueList
          title="Active"
          tasks={overview.activeTasks}
          emptyMessage="No active tasks."
          tone="warn"
          dueThisWeekIds={dueThisWeekIds}
        />
        <TaskDueList title="Overdue" tasks={overview.overdueTasks} emptyMessage="No overdue tasks." tone="danger" />
      </div>
    </Modal>
  </>;
}
