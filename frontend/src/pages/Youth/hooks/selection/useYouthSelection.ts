import { useCallback, useState } from 'react';
import type { YouthProfile } from '../../types';

/**
 * Keeps the selected Youth profile across table changes.
 * @example useYouthSelection()
 */
export function useYouthSelection() {
  const [selectedProfile, setSelectedProfile] = useState<YouthProfile | null>(null);
  const selectedProfileId = selectedProfile?.id ?? null;
  const selectProfile = useCallback((profile: YouthProfile | null) => {
    setSelectedProfile(profile);
  }, []);
  const updateSelectedProfile = useCallback((profile: YouthProfile) => {
    setSelectedProfile(current => current?.id === profile.id ? profile : current);
  }, []);

  return { selectedProfile, selectedProfileId, selectProfile, updateSelectedProfile };
}
