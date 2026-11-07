import type { ProgramSession } from '../../types';
import type { PageMessageValue } from '../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import SessionNotesDashboardCard from './SessionNotesDashboardCard/SessionNotesDashboardCard';
import { useSessionDashboardErrors } from './hooks/useSessionDashboardErrors';

interface SessionDashboardProps {
  sessionQueryKey: readonly unknown[];
  session: ProgramSession | null;
  canReadAttendance: boolean;
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onAddAttendance: (session: ProgramSession) => void;
  onErrorsChange?: (errors: PageMessageValue[]) => void;
}

export default function SessionDashboard({
  sessionQueryKey, session, canReadAttendance, canWriteAttendance, canWriteSessions, onAddAttendance, onErrorsChange,
}: SessionDashboardProps) {
  const { setAttendanceError, setNotesError, setAttachmentsError } = useSessionDashboardErrors(onErrorsChange);

  return <>
    {canReadAttendance && <SessionAttendanceDashboardCard
      session={session}
      canWrite={canWriteAttendance}
      onManage={onAddAttendance}
      onMessageChange={setAttendanceError}
    />}
    <SessionNotesDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onMessageChange={setNotesError} />
    <SessionAttachmentsDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onMessageChange={setAttachmentsError} />
  </>;
}
