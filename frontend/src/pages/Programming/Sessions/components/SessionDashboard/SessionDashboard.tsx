import { useEffect, useState } from 'react';
import type { CohortSession } from '../../../../../common/types/cohort';
import type { PageErrorItem } from '../../../../../common/components/PageErrorOverlay/PageErrorOverlay';
import SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import SessionNotesDashboardCard from './SessionNotesDashboardCard/SessionNotesDashboardCard';

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
  const [notesError, setNotesError] = useState<PageErrorItem | null>(null);
  const [attachmentsError, setAttachmentsError] = useState<PageErrorItem | null>(null);

  useEffect(() => {
    if (!onErrorsChange) return undefined;

    onErrorsChange([notesError, attachmentsError].filter((error): error is PageErrorItem => error !== null));
    return () => onErrorsChange([]);
  }, [attachmentsError, notesError, onErrorsChange]);

  return <>
    <SessionAttendanceDashboardCard session={session} canWrite={canWriteAttendance} onManage={onAddAttendance} />
    <SessionNotesDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onErrorChange={setNotesError} />
    <SessionAttachmentsDashboardCard queryKey={sessionQueryKey} session={session} canWrite={canWriteSessions} onErrorChange={setAttachmentsError} />
  </>;
}
