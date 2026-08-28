import { useCallback, useEffect, useState } from 'react';
import type { YouthProfile } from '../../types';

interface UseYouthSelectionOptions {
  onSelectedProfileIdChange: () => void;
}

export function useYouthSelection({ onSelectedProfileIdChange }: UseYouthSelectionOptions) {
  const [selectedProfile, setSelectedProfile] = useState<YouthProfile | null>(null);
  const selectedProfileId = selectedProfile?.id ?? null;
  const reconcileSavedProfile = useCallback((savedProfile: YouthProfile) => {
    setSelectedProfile(current => current?.id === savedProfile.id ? savedProfile : current);
  }, []);

  useEffect(() => {
    onSelectedProfileIdChange();
  }, [onSelectedProfileIdChange, selectedProfileId]);

  return {
    selectedProfile,
    selectedProfileId,
    selectProfile: setSelectedProfile,
    reconcileSavedProfile,
  };
}
