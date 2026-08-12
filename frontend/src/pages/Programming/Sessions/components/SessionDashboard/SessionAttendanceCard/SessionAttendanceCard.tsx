import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import type { CohortSession } from '../../../../../../common/types/cohort';

const getAttendanceSummary = (session: CohortSession | null) => {
  if (!session || session.attendanceRate === null) return null;
  if (session.rosterMode === 'open') return session.attendanceMarkedCount ? `${session.attendanceMarkedCount} check-ins` : null;
  return `${session.attendedCount}/${session.attendanceMarkedCount}`;
};

export default function SessionAttendanceCard({
  session, canWrite, onManage,
}: { session: CohortSession | null; canWrite: boolean; onManage: (session: CohortSession) => void }) {
  const summary = getAttendanceSummary(session);
  return <DashboardCard
    title="Attendance"
    emptyMessage="No session selected."
    action={canWrite ? <Button
      size="sm"
      variant="secondary"
      disabled={!session}
      aria-label="Manage attendance"
      onClick={() => { if (session) onManage(session); }}
    >Manage</Button> : undefined}
  >
    {session ? <p className={summary ? undefined : 'dashboard-card__empty'}>{summary ?? 'No attendance.'}</p> : undefined}
  </DashboardCard>;
}
