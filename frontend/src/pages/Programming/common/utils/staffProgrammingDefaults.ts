import type { ProgramCohort } from '../../../../common/types/cohort';
import type { Program } from '../../../../common/features/programs/types';

export function getSingleAssignedProgram(
  role: string | null | undefined,
  programs: Program[],
): Program | null {
  if (role !== 'staff') return null;
  const assignedPrograms = programs.filter(program => program.rosterMode === 'enrolled');
  return assignedPrograms.length === 1 ? assignedPrograms[0] : null;
}

export function getSingleActiveCohort(
  cohorts: ProgramCohort[],
  programId: string,
): ProgramCohort | null {
  const activeCohorts = cohorts.filter(
    cohort => cohort.programId === programId && cohort.state === 'active',
  );
  return activeCohorts.length === 1 ? activeCohorts[0] : null;
}
