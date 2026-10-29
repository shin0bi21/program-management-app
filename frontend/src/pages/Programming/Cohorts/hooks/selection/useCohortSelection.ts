import { useCallback, useState } from 'react';

import type { ProgramCohort } from '../../types';

export default function useCohortSelection() {
  const [selectedCohort, setSelectedCohort] = useState<ProgramCohort | null>(null);

  const removeSelectedCohort = useCallback((cohortId: string) => {
    setSelectedCohort(current => current?.id === cohortId ? null : current);
  }, []);

  const syncSelectedCohort = useCallback((cohort: ProgramCohort) => {
    setSelectedCohort(current => current?.id === cohort.id ? cohort : current);
  }, []);

  return { syncSelectedCohort, selectedCohort, setSelectedCohort, removeSelectedCohort };
}
