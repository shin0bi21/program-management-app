import type { CohortSession } from '../../../../../common/types/cohort';
import SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import SessionNotesDashboardCard from './SessionNotesDashboardCard/SessionNotesDashboardCard';

interface SessionDashboardProps {
  session: CohortSession | null;
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onAddAttendance: (session: CohortSession) => void;
}

export default function SessionDashboard({
  session, canWriteAttendance, canWriteSessions, onAddAttendance,
}: SessionDashboardProps) {
  return <>
    <SessionAttendanceDashboardCard session={session} canWrite={canWriteAttendance} onManage={onAddAttendance} />
    <SessionNotesDashboardCard session={session} canWrite={canWriteSessions} />
    <SessionAttachmentsDashboardCard session={session} canWrite={canWriteSessions} />
  </>;
}
