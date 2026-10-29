import { useCallback, useMemo, useState } from 'react';

import type { Program } from '../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';

export default function useProgramsModals() {
  const [programTarget, setProgramTarget] = useState<Program | null | undefined>(undefined);
  const [assignmentsTarget, setAssignmentsTarget] = useState<Program | null>(null);
  const [cycleTarget, setCycleTarget] = useState<ProgramCycle | null | undefined>(undefined);

  const openProgram = useCallback((program: Program | null) => setProgramTarget(program), []);
  const closeProgram = useCallback(() => setProgramTarget(undefined), []);
  const openCycle = useCallback((cycle: ProgramCycle | null) => setCycleTarget(cycle), []);
  const closeCycle = useCallback(() => setCycleTarget(undefined), []);

  const openAssignments = useCallback((program: Program) => setAssignmentsTarget(program), []);
  const closeAssignments = useCallback(() => setAssignmentsTarget(null), []);

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

  return { program, cycle, assignments: { target: assignmentsTarget, open: openAssignments, close: closeAssignments } };
}
