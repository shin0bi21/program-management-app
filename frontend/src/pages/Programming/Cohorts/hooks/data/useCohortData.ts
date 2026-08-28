import { useCallback, useEffect, useState } from 'react';

import { getProgramCycles } from '../../../../../common/features/programming/api/cohorts.api';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';
import type { ProgramCycle } from '../../../../../common/types/cohort';

export default function useCohortData() {
  const { programs, loading: programsLoading, error: programsError } = usePrograms({ assignedOnly: true });
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesError, setCyclesError] = useState<string | null>(null);

  const loadCycles = useCallback(async (signal?: AbortSignal) => {
    try {
      const nextCycles = await getProgramCycles(signal ? { signal } : undefined);
      setCycles(nextCycles);
      setCyclesError(null);
    } catch (cause) {
      if (signal?.aborted) return;
      setCyclesError(cause instanceof Error ? cause.message : 'Could not load cycles');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCycles(controller.signal);
    return () => controller.abort();
  }, [loadCycles]);

  return {
    programs,
    programsLoading,
    programsError,
    cycles,
    cyclesError,
  };
}
