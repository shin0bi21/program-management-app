import { useEffect, useState } from 'react';
import type { PageErrorItem } from '../../../../../../common/components/PageErrorOverlay/PageErrorOverlay';

export function useSessionDashboardErrors(onErrorsChange?: (errors: PageErrorItem[]) => void) {
  const [notesError, setNotesError] = useState<PageErrorItem | null>(null);
  const [attachmentsError, setAttachmentsError] = useState<PageErrorItem | null>(null);

  useEffect(() => {
    if (!onErrorsChange) return undefined;
    onErrorsChange([notesError, attachmentsError].filter((error): error is PageErrorItem => error !== null));
    return () => onErrorsChange([]);
  }, [attachmentsError, notesError, onErrorsChange]);

  return { setNotesError, setAttachmentsError };
}
