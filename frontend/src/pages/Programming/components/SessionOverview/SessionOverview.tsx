import Button from '../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../common/components/DashboardCard/DashboardCard';
import type { ManagedSession } from '../../../../common/types/cohort';

interface SessionOverviewProps {
  session: ManagedSession | null;
  canWriteAttendance: boolean;
  canWriteNotes: boolean;
  onAddAttendance: (session: ManagedSession) => void;
}

const getAttendanceSummary = (session: ManagedSession | null) => {
  if (!session || session.attendanceRate === null) return null;
  if (session.rosterMode === 'open') {
    return session.attendanceMarkedCount
      ? `${session.attendanceMarkedCount} check-ins`
      : null;
  }
  return `${session.attendedCount}/${session.attendanceMarkedCount}`;
};

export default function SessionOverview({
  session,
  canWriteAttendance,
  canWriteNotes,
  onAddAttendance,
}: SessionOverviewProps) {
  const attendanceSummary = getAttendanceSummary(session);

  return (
    <>
      <DashboardCard
        title="Attendance"
        emptyMessage="No session selected."
        action={canWriteAttendance ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!session}
            aria-label="Add attendance"
            onClick={() => {
              if (session) onAddAttendance(session);
            }}
          >
            + Add
          </Button>
        ) : undefined}
      >
        {session ? (
          <p className={attendanceSummary ? undefined : 'dashboard-card__empty'}>
            {attendanceSummary ?? 'No attendance.'}
          </p>
        ) : undefined}
      </DashboardCard>
      <DashboardCard
        title="Session notes"
        emptyMessage={session ? 'No notes.' : 'No session selected.'}
        action={canWriteNotes ? (
          <Button
            size="sm"
            variant="secondary"
            disabled
            aria-label="Add notes"
            title="Session note support is not available yet"
          >
            + Add
          </Button>
        ) : undefined}
      />
      <DashboardCard
        title="Worksheets"
        emptyMessage={session ? 'Not available yet.' : 'No session selected.'}
        action={(
          <Button
            size="sm"
            variant="secondary"
            disabled
            aria-label="Add worksheets"
            title="Worksheet support is not available yet"
          >
            + Add
          </Button>
        )}
      />
    </>
  );
}
