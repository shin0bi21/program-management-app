import { useMemo, useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import { dayKey } from '../../../../../common/components/ResourceCalendar/periods';
import type { Task } from '../../../../../common/features/tasks/types';
import { formatShortDate } from '../../../../../common/utils/date';
import { groupTasksForOverview } from '../../taskOverview';
import './TaskOverviewCard.css';

function TaskDueList({ title, tasks, emptyMessage }: {
  title: string;
  tasks: readonly Task[];
  emptyMessage: string;
}) {
  return <section className="task-overview-card__task-section">
    <h3>{title}</h3>
    {tasks.length ? <ul>
      {tasks.map(task => <li key={task.id}>
        <strong>{task.title}</strong>
        <span>Due {formatShortDate(task.dueDate)}</span>
      </li>)}
    </ul> : <p>{emptyMessage}</p>}
  </section>;
}

export default function TaskOverviewCard({ tasks, resourceName }: {
  tasks: readonly Task[];
  resourceName: string;
}) {
  const [open, setOpen] = useState(false);
  const overview = useMemo(() => groupTasksForOverview(tasks, dayKey(new Date())), [tasks]);
  const summary = {
    assigned: overview.activeTasks.length,
    dueThisWeek: overview.dueThisWeekTasks.length,
    overdue: overview.overdueTasks.length,
  };

  return <>
    <DashboardCard
      title="Task Overview"
      action={<Button size="sm" variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>See Overview</Button>}
    >
      <dl className="task-overview-card__metrics">
        <div><dt>Tasks Assigned</dt><dd>{summary.assigned}</dd></div>
        <div><dt>Due This Week</dt><dd>{summary.dueThisWeek}</dd></div>
        <div><dt>Overdue</dt><dd>{summary.overdue}</dd></div>
      </dl>
    </DashboardCard>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={`${resourceName} Task Overview`} maxWidth="520px">
      <dl className="task-overview-card__report">
        <div><dt>Currently Assigned</dt><dd>{summary.assigned}</dd></div>
        <div><dt>Due This Week</dt><dd>{summary.dueThisWeek}</dd></div>
        <div><dt>Overdue</dt><dd>{summary.overdue}</dd></div>
      </dl>
      <div className="task-overview-card__task-lists">
        <TaskDueList title="Overdue Tasks" tasks={overview.overdueTasks} emptyMessage="No overdue tasks." />
        <TaskDueList title="Due This Week" tasks={overview.dueThisWeekTasks} emptyMessage="No tasks due this week." />
      </div>
    </Modal>
  </>;
}
