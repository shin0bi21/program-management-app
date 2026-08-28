import { useCallback, useMemo, useState } from 'react';

import type { Program } from '../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../common/types/cohort';

export default function useProgrammingModals() {
  const [programTarget, setProgramTarget] = useState<Program | null | undefined>(undefined);
  const [cycleTarget, setCycleTarget] = useState<ProgramCycle | null | undefined>(undefined);

  const openProgram = useCallback((program: Program | null) => setProgramTarget(program), []);
  const closeProgram = useCallback(() => setProgramTarget(undefined), []);
  const openCycle = useCallback((cycle: ProgramCycle | null) => setCycleTarget(cycle), []);
  const closeCycle = useCallback(() => setCycleTarget(undefined), []);

  const program = useMemo(() => ({
    target: programTarget,
    open: openProgram,
    close: closeProgram,
  }), [closeProgram, openProgram, programTarget]);

  const cycle = useMemo(() => ({
    target: cycleTarget,
    open: openCycle,
    close: closeCycle,
  }), [closeCycle, cycleTarget, openCycle]);

  return { program, cycle };
}
