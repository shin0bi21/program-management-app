import { useEffect, useState } from 'react';

import type { CohortRosterYouth, ProgramCohort } from '../../../types';
import { getAge } from '../../../../../../common/utils/time';

function isWithinAgeRange(
  profile: CohortRosterYouth,
  ageRange: { min: number; max: number },
) {
  const age = getAge(profile.dateOfBirth);
  return age !== null && age >= ageRange.min && age <= ageRange.max;
}

export function useYouthEnrollmentSelection(
  cohort: ProgramCohort | null,
  unenrolledYouth: CohortRosterYouth[],
) {
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [ageFilterEnabled, setAgeFilterEnabled] = useState(true);
  const cohortId = cohort?.id;
  const minAge = cohort?.minAge ?? null;
  const maxAge = cohort?.maxAge ?? null;
  const ageRange = minAge !== null && maxAge !== null ? { min: minAge, max: maxAge } : null;

  useEffect(() => {
    if (!cohortId) return;
    setSelectedYouthIds([]);
    setAgeFilterEnabled(true);
  }, [cohortId]);

  const availableYouth = ageFilterEnabled && ageRange
    ? unenrolledYouth.filter((profile) => isWithinAgeRange(profile, ageRange))
    : unenrolledYouth;

  const toggleYouth = (youthId: string) => {
    setSelectedYouthIds((current) => (
      current.includes(youthId)
        ? current.filter((id) => id !== youthId)
        : [...current, youthId]
    ));
  };

  const setAgeFilter = (enabled: boolean) => {
    setAgeFilterEnabled(enabled);
    if (!enabled || !ageRange) return;

    setSelectedYouthIds((selected) => selected.filter((id) => {
      const profile = unenrolledYouth.find((item) => item.id === id);
      return profile ? isWithinAgeRange(profile, ageRange) : false;
    }));
  };

  return {
    selectedYouthIds,
    selectedCount: selectedYouthIds.length,
    ageFilterEnabled,
    minAge,
    maxAge,
    hasAgeRange: ageRange !== null,
    availableYouth,
    toggleYouth,
    setAgeFilter,
  };
}
