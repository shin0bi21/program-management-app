import type { CohortSession } from '../../../../../common/types/cohort';
import type { PageErrorItem } from '../../../../../common/components/PageErrorOverlay/PageErrorOverlay';
import SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import SessionNotesDashboardCard from './SessionNotesDashboardCard/SessionNotesDashboardCard';
import { useSessionDashboardErrors } from './hooks/useSessionDashboardErrors';

interface SessionDashboardProps {
  sessionQueryKey: readonly unknown[];
  session: CohortSession | null;
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onAddAttendance: (session: CohortSession) => void;
  onErrorsChange?: (errors: PageErrorItem[]) => void;
}

export default function SessionDashboard({
  sessionQueryKey, session, canWriteAttendance, canWriteSessions, onAddAttendance, onErrorsChange,
}: SessionDashboardProps) {
  const { setNotesError, setAttachmentsError } = useSessionDashboardErrors(onErrorsChange);

  return <>
    <SessionAttendanceDashboardCard session={session} canWrite={canWriteAttendance} onManage={onAddAttendance} />
    <SessionNotesDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onErrorChange={setNotesError} />
    <SessionAttachmentsDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onErrorChange={setAttachmentsError} />
  </>;
}
