import { useEffect, useState } from 'react';
import type { PageMessageValue } from '../../../../../../common/components/PageMessageOverlay/PageMessageOverlay';

export function useSessionDashboardErrors(onErrorsChange?: (errors: PageMessageValue[]) => void) {
  const [notesError, setNotesError] = useState<PageMessageValue>(null);
  const [attachmentsError, setAttachmentsError] = useState<PageMessageValue>(null);

  useEffect(() => {
    if (!onErrorsChange) return undefined;
    onErrorsChange([notesError, attachmentsError].filter(message => message !== null));
    return () => onErrorsChange([]);
  }, [attachmentsError, notesError, onErrorsChange]);

  return { setNotesError, setAttachmentsError };
}
