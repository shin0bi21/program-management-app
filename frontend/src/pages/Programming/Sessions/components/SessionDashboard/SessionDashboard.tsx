import type { CohortSession } from '../../../../../common/types/cohort';
import SessionAttachmentsCard from './SessionAttachmentsCard/SessionAttachmentsCard';
import SessionAttendanceCard from './SessionAttendanceCard/SessionAttendanceCard';
import SessionNotesCard from './SessionNotesCard/SessionNotesCard';

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
    <SessionAttendanceCard session={session} canWrite={canWriteAttendance} onManage={onAddAttendance} />
    <SessionNotesCard session={session} canWrite={canWriteSessions} />
    <SessionAttachmentsCard session={session} canWrite={canWriteSessions} />
  </>;
}
