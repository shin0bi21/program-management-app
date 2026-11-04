import type { ProgramSession } from '../../types';
import type { PageMessageValue } from '../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import SessionNotesDashboardCard from './SessionNotesDashboardCard/SessionNotesDashboardCard';
import { useSessionDashboardErrors } from './hooks/useSessionDashboardErrors';

interface SessionDashboardProps {
  sessionQueryKey: readonly unknown[];
  session: ProgramSession | null;
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onAddAttendance: (session: ProgramSession) => void;
  onErrorsChange?: (errors: PageMessageValue[]) => void;
}

export default function SessionDashboard({
  sessionQueryKey, session, canWriteAttendance, canWriteSessions, onAddAttendance, onErrorsChange,
}: SessionDashboardProps) {
  const { setNotesError, setAttachmentsError } = useSessionDashboardErrors(onErrorsChange);

  return <>
    <SessionAttendanceDashboardCard session={session} canWrite={canWriteAttendance} onManage={onAddAttendance} />
    <SessionNotesDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onMessageChange={setNotesError} />
    <SessionAttachmentsDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onMessageChange={setAttachmentsError} />
  </>;
}
