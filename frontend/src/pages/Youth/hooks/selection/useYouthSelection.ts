import { useCallback, useEffect, useState } from 'react';
import type { YouthProfile } from '../../types';

interface UseYouthSelectionOptions {
  onSelectedProfileIdChange: () => void;
}

/**
 * Keeps a selected Youth identifier across table changes and resolves its latest saved profile.
 * @param records - Current saved profiles supplied by the page data owner.
 * @param options - Callback that closes dependent workflows when the selected ID changes.
 * @example useYouthSelection(records, { onSelectedProfileIdChange: closeAttendance })
 */
export function useYouthSelection(records: Readonly<Record<string, YouthProfile>>, { onSelectedProfileIdChange }: UseYouthSelectionOptions) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const selectedProfile = selectedProfileId ? records[selectedProfileId] ?? null : null;
  const selectProfile = useCallback((profile: YouthProfile | null) => {
    setSelectedProfileId(profile?.id ?? null);
  }, []);

  useEffect(() => {
    onSelectedProfileIdChange();
  }, [onSelectedProfileIdChange, selectedProfileId]);

  return { selectedProfile, selectedProfileId, selectProfile };
}
