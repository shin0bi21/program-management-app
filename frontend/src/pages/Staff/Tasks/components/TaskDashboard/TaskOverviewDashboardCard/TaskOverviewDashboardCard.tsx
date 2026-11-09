import { useEffect, useMemo, useState } from 'react';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Button from '../../../../../../common/components/Button/Button';
import Modal from '../../../../../../common/components/Modal/Modal';
import { dayKey } from '../../../../../../common/components/TimelineCalendar/utils/periods';
import type { Task } from '../../../types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import useTaskOverviewData from './hooks/useTaskOverviewData';
import './TaskOverviewDashboardCard.css';

const compactDateFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });

/**
 * Queries the selected staff overview and displays its queried tasks.
 * @param props - staff identity, local date, and page-message reporter.
 * @example <TaskOverviewDashboardCard {...overviewProps} />
 */
export default function TaskOverviewDashboardCard({ queryKey, resourceId, resourceName, today, onMessageChange }: {
  queryKey: readonly unknown[];
  resourceId: string;
  resourceName: string;
  today: string;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const overviewData = useTaskOverviewData(queryKey, resourceId);
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: overviewData.retry }), [overviewData.retry]);
  usePageMessageReporter(onMessageChange, overviewData.error, retryAction);

  return <TaskOverviewContent
    tasks={overviewData.tasks}
    loading={overviewData.loading}
    error={overviewData.error}
    onRetry={overviewData.retry}
    resourceId={resourceId}
    resourceName={resourceName}
    today={today}
  />;
}

/**
 * Displays a staff overview and keeps its report scoped to the current staff selection.
 * @param props - Current tasks, query feedback, staff identity, and local reporting date.
 * @example <TaskOverviewContent tasks={tasks} {...reportProps} />
 */
function TaskOverviewContent({ tasks, loading, error, onRetry, resourceId, resourceName, today }: {
  tasks: readonly Task[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  resourceId: string;
  resourceName: string;
  today: string;
}) {
  const [openResourceId, setOpenResourceId] = useState<string | null>(null);

  const unavailable = loading || Boolean(error);
  useEffect(() => setOpenResourceId(null), [resourceId, unavailable]);

  const overview = useMemo(() => groupTasksForOverview(tasks, today), [tasks, today]);
  const summary = {
    assigned: overview.assignedTasks.length,
    upcoming: overview.upcomingTasks.length,
    inProgress: overview.inProgressTasks.length,
    overdue: overview.overdueTasks.length,
  };
  const dueThisWeekIds = new Set(overview.dueThisWeekTasks.map(task => task.id));

  return <>
    <DashboardCard
      title="Task Overview"
      className="dashboard-card--short task-overview-card"
      loading={loading}
      details={[
        { label: 'Assigned', value: error ? null : summary.assigned },
        { label: 'Upcoming', value: error ? null : summary.upcoming },
        { label: 'In Progress', value: error ? null : summary.inProgress },
        { label: 'Overdue', value: error ? null : summary.overdue },
      ]}
      action={<Button
        size="sm"
        variant="secondary"
        aria-haspopup="dialog"
        disabled={unavailable}
        onClick={() => setOpenResourceId(resourceId)}
      >See Breakdown</Button>}
    >
      {error && <UnavailableState compact title="Task overview unavailable" onRetry={onRetry} />}
    </DashboardCard>
    <Modal isOpen={openResourceId === resourceId && !unavailable} onClose={() => setOpenResourceId(null)} title={resourceName} maxWidth="560px">
      <dl className="task-overview-card__report" aria-label="Task summary">
        <div><dt>Assigned</dt><dd>{summary.assigned}</dd></div>
        <div className="task-overview-card__report-upcoming"><dt>Upcoming</dt><dd>{summary.upcoming}</dd></div>
        <div className="task-overview-card__report-in-progress"><dt>In Progress</dt><dd>{summary.inProgress}</dd></div>
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
          title="In Progress"
          tasks={overview.inProgressTasks}
          emptyMessage="No in progress tasks."
          tone="warn"
          dueThisWeekIds={dueThisWeekIds}
        />
        <TaskDueList title="Overdue" tasks={overview.overdueTasks} emptyMessage="No overdue tasks." tone="danger" />
      </div>
    </Modal>
  </>;
}

/**
 * Groups open tasks by their server-derived status and identifies those due this week.
 * @param tasks - Current saved tasks for the selected staff member.
 * @param today - Current local calendar date used for the week boundary.
 * @example groupTasksForOverview(tasks, '2026-08-11').overdueTasks // open overdue tasks
 */
function groupTasksForOverview(tasks: readonly Task[], today: string) {
  const assignedTasks = tasks.filter(task => task.state === 'open');
  const upcomingTasks = assignedTasks.filter(task => task.status === 'upcoming');
  const inProgressTasks = assignedTasks.filter(task => task.status === 'in_progress');
  const overdueTasks = assignedTasks.filter(task => task.status === 'overdue');
  const weekEnd = currentWeekEnd(today);
  const dueThisWeekTasks = [...upcomingTasks, ...inProgressTasks]
    .filter(task => task.dueDate >= today && task.dueDate <= weekEnd);

  return {
    assignedTasks: sortByDueDate(assignedTasks),
    upcomingTasks: sortByDueDate(upcomingTasks),
    inProgressTasks: sortByDueDate(inProgressTasks),
    overdueTasks: sortByDueDate(overdueTasks),
    dueThisWeekTasks,
  };
}

/**
 * Finds the Sunday ending the current Monday-to-Sunday week.
 * @param today - Current local calendar date in YYYY-MM-DD form.
 * @example currentWeekEnd('2026-08-11') // '2026-08-16'
 */
function currentWeekEnd(today: string) {
  const date = parseCalendarDate(today);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday + 6);
  return dayKey(date);
}

/**
 * Converts an ISO calendar date to a browser-local date without UTC day shifts.
 * @param value - A valid YYYY-MM-DD calendar date.
 * @example parseCalendarDate('2026-08-11').getDate() // 11
 */
function parseCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Orders tasks by due date and then title without changing the supplied array.
 * @example sortByDueDate(tasks) // earliest due task first
 */
function sortByDueDate(tasks: readonly Task[]) {
  return [...tasks].sort((left, right) => (
    left.dueDate.localeCompare(right.dueDate) || left.title.localeCompare(right.title)
  ));
}

/**
 * Displays one status group's task titles and due dates, highlighting tasks due this week.
 * @param props - Section heading, ordered tasks, empty wording, tone, and optional highlighted IDs.
 * @example <TaskDueList title="Overdue" tasks={tasks} emptyMessage="No overdue tasks." />
 */
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

/**
 * Formats an ISO calendar date as a short month and day in browser-local time.
 * @param value - A valid YYYY-MM-DD calendar date.
 * @example formatCompactDate('2026-08-11') // 'Aug 11'
 */
function formatCompactDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return compactDateFormatter.format(new Date(year, month - 1, day, 12));
}
