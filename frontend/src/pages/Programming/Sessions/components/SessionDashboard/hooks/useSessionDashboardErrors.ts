import { useEffect, useState } from 'react';
import type { PageMessageValue } from '../../../../../../common/components/PageMessageOverlay/PageMessageOverlay';

/**
 * Collects attendance, notes, and attachment messages for the page and clears them on teardown.
 * @example useSessionDashboardErrors(reportErrors) // supplies one message setter per card
 */
export function useSessionDashboardErrors(onErrorsChange?: (errors: PageMessageValue[]) => void) {
  const [attendanceError, setAttendanceError] = useState<PageMessageValue>(null);
  const [notesError, setNotesError] = useState<PageMessageValue>(null);
  const [attachmentsError, setAttachmentsError] = useState<PageMessageValue>(null);

  useEffect(() => {
    if (!onErrorsChange) return undefined;
    onErrorsChange([attendanceError, notesError, attachmentsError].filter(message => message !== null));
    return () => onErrorsChange([]);
  }, [attendanceError, attachmentsError, notesError, onErrorsChange]);

  return { setAttendanceError, setNotesError, setAttachmentsError };
}
