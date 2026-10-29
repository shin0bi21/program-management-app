import TaskHoursLoggedDashboardCard from './TaskHoursLoggedDashboardCard';

export function LoggedHours() {
  return <div style={{ width: 'min(100%, 360px)' }}>
    <TaskHoursLoggedDashboardCard task={null} onLogHours={() => {}} />
  </div>;
}
