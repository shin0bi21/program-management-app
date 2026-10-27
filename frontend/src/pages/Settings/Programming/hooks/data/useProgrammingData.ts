import { useCallback, useEffect, useState } from 'react';

import { getProgramCycles } from '../../../../../common/features/programming/cycles/cycles.api';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import { getErrorMessage } from '../../../../../http/errors';

export default function useProgrammingData() {
  const programs = usePrograms();
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [cyclesError, setCyclesError] = useState<string | null>(null);

  const loadCycles = useCallback(async (signal?: AbortSignal) => {
    setCyclesLoading(true);

    try {
      setCycles(await getProgramCycles(signal ? { signal } : undefined));
      setCyclesError(null);
    } catch (cause) {
      if (!signal?.aborted) {
        setCyclesError(getErrorMessage(cause, 'Could not load cycles'));
      }
    } finally {
      if (!signal?.aborted) setCyclesLoading(false);
    }
  }, []);

  const refreshCycles = useCallback(async () => {
    await loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCycles(controller.signal);

    return () => controller.abort();
  }, [loadCycles]);

  const removeCycle = useCallback((cycleId: string) => {
    setCycles(current => current.filter(cycle => cycle.id !== cycleId));
  }, []);

  return {
    programs: programs.programs,
    upsertProgram: programs.upsertProgram,
    programsLoading: programs.loading,
    programsError: programs.error,
    retryPrograms: programs.retry,
    cycles,
    cyclesLoading,
    cyclesError,
    refreshCycles,
    removeCycle,
  };
}
