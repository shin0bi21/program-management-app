import { Temporal } from 'temporal-polyfill';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Button from '../../../../../../common/components/Button/Button';
import Modal from '../../../../../../common/components/Modal/Modal';
import { getDate } from '../../../../../../common/utils/date';
import type { StaffReference } from '../../../../../../common/features/referenceData/referenceData.api';
import type { Task } from '../../../types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import useTaskOverviewData from './hooks/useTaskOverviewData';
import './TaskOverviewDashboardCard.css';

interface TaskOverviewDashboardCardProps {
  queryKey: readonly unknown[];
  staff: StaffReference | null;
  onMessageChange?: PageMessageChangeHandler;
}

interface TaskDueListProps {
  title: string;
  tasks: readonly Task[];
  emptyMessage: string;
  tone?: 'neutral' | 'info' | 'warn' | 'danger';
  dueThisWeekIds?: ReadonlySet<string>;
}

/**
 * Queries the selected staff overview and owns its report for the current local date.
 * Keeps an unselected card without loading tasks when no staff member is supplied.
 * @param props - Shared staff context, query namespace, and optional page-message reporter.
 * @example <TaskOverviewDashboardCard queryKey={['tasks']} staff={staff} />
 */
export default function TaskOverviewDashboardCard({
  queryKey, staff, onMessageChange,
}: TaskOverviewDashboardCardProps): ReactElement {
  const staffId = staff?.id ?? null;
  const overviewData = useTaskOverviewData(queryKey, staffId);
  const { tasks, loading, error, retry: onRetry } = overviewData;
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: onRetry }), [onRetry]);
  usePageMessageReporter(onMessageChange, error, retryAction);

  const today = getDate();
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);

  const unavailable = !staffId || loading || Boolean(error);
  useEffect(() => setOpenStaffId(null), [staffId, unavailable]);

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
        { label: 'Assigned', value: !staffId || error ? null : summary.assigned },
        { label: 'Upcoming', value: !staffId || error ? null : summary.upcoming },
        { label: 'In Progress', value: !staffId || error ? null : summary.inProgress },
        { label: 'Overdue', value: !staffId || error ? null : summary.overdue },
      ]}
      action={<Button
        size="sm"
        variant="secondary"
        aria-haspopup="dialog"
        disabled={unavailable}
        onClick={() => setOpenStaffId(staffId)}
      >See Breakdown</Button>}
    >
      {!staffId && <p className="dashboard-card__empty">Select a staff member to view their tasks.</p>}
      {error && <UnavailableState
        compact
        title="Task overview unavailable"
        onRetry={onRetry}
      />}
    </DashboardCard>
    <Modal
      isOpen={Boolean(staffId) && openStaffId === staffId && !unavailable}
      onClose={() => setOpenStaffId(null)}
      title={staff?.name ?? ''}
      maxWidth="560px"
    >
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
        <TaskDueList
          title="Overdue"
          tasks={overview.overdueTasks}
          emptyMessage="No overdue tasks."
          tone="danger"
        />
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
  const date = Temporal.PlainDate.from(today);
  return date.add({ days: 7 - date.dayOfWeek }).toString();
}

/**
 * Orders tasks by due date and then title without changing the supplied array.
 * @param tasks - Saved tasks to order for the report.
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
function TaskDueList({
  title, tasks, emptyMessage, tone = 'neutral', dueThisWeekIds,
}: TaskDueListProps) {
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
 * Formats a business date directly as a short month and day.
 * @param value - A valid YYYY-MM-DD calendar date.
 * @example formatCompactDate('2026-08-11') // 'Aug 11'
 */
function formatCompactDate(value: string) {
  return Temporal.PlainDate.from(value).toLocaleString('en-CA', { month: 'short', day: 'numeric' });
}
