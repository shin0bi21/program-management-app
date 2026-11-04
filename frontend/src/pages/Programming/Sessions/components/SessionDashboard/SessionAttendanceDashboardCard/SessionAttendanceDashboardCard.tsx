import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import type { ProgramSession } from '../../../types';

const getAttendanceSummary = (session: ProgramSession | null) => {
  if (!session || session.attendanceRate === null) return null;
  if (!session.enrollmentRequired) return session.attendanceMarkedCount ? `${session.attendanceMarkedCount} check-ins` : null;
  return `${session.attendedCount}/${session.attendanceMarkedCount}`;
};

export default function SessionAttendanceDashboardCard({
  session, canWrite, onManage,
}: { session: ProgramSession | null; canWrite: boolean; onManage: (session: ProgramSession) => void }) {
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
