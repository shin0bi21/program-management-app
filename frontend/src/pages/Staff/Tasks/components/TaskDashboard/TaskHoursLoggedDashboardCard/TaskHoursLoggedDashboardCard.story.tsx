import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard';

/** Displays the unselected logged-hours card. @example <LoggedHours /> */
export function LoggedHours() {
  return <div style={{ width: 'min(100%, 360px)' }}>
    <TaskHoursLoggedDashboardCard
      task={null}
      canWrite
      onLogHours={() => {}}
    />
  </div>;
}
