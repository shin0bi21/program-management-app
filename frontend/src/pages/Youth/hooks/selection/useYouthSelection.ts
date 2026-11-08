import { useCallback, useEffect, useState } from 'react';
import type { YouthProfile } from '../../types';

interface UseYouthSelectionOptions {
  onSelectedProfileIdChange: () => void;
}

/**
 * Keeps the selected Youth profile across table changes.
 * @param options - Callback that closes dependent workflows when the selected ID changes.
 * @example useYouthSelection({ onSelectedProfileIdChange: closeAttendance })
 */
export function useYouthSelection({ onSelectedProfileIdChange }: UseYouthSelectionOptions) {
  const [selectedProfile, setSelectedProfile] = useState<YouthProfile | null>(null);
  const selectedProfileId = selectedProfile?.id ?? null;
  const selectProfile = useCallback((profile: YouthProfile | null) => {
    setSelectedProfile(profile);
  }, []);
  const updateSelectedProfile = useCallback((profile: YouthProfile) => {
    setSelectedProfile(current => current?.id === profile.id ? profile : current);
  }, []);

  useEffect(() => {
    onSelectedProfileIdChange();
  }, [onSelectedProfileIdChange, selectedProfileId]);

  return { selectedProfile, selectedProfileId, selectProfile, updateSelectedProfile };
}
