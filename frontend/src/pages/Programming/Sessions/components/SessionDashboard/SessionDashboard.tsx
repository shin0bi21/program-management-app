import type { CohortSession } from '../../../../../common/types/cohort';
import SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import SessionNotesDashboardCard from './SessionNotesDashboardCard/SessionNotesDashboardCard';

interface SessionDashboardProps {
  sessionQueryKey: readonly unknown[];
  session: CohortSession | null;
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onAddAttendance: (session: CohortSession) => void;
}

export default function SessionDashboard({
  sessionQueryKey, session, canWriteAttendance, canWriteSessions, onAddAttendance,
}: SessionDashboardProps) {
  return <>
    <SessionAttendanceDashboardCard session={session} canWrite={canWriteAttendance} onManage={onAddAttendance} />
    <SessionNotesDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} />
    <SessionAttachmentsDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} />
  </>;
}
