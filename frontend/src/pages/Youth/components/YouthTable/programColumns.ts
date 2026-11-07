import { compareListSortValues } from '../../../../query/listOrdering';
import type { YouthProfile } from '../../types';

export function getActiveProgramLabels(profile: YouthProfile, today: string): string[] {
  const names = profile.programCycles
    .filter(programCycle => (
      programCycle.enrollmentRequired
      && programCycle.enrolledOn !== null
      && programCycle.enrolledOn <= today
      && programCycle.startsOn <= today
      && programCycle.endsOn >= today
      && (programCycle.withdrawnOn === null || programCycle.withdrawnOn > today)
    ))
    .map(programCycle => programCycle.program);

  return [...new Set(names)].sort(compareListSortValues);
}

export function getCompletedProgramLabels(profile: YouthProfile, today: string): string[] {
  const names = profile.programCycles
    .filter(programCycle => (
      programCycle.enrollmentRequired
      && programCycle.enrolledOn !== null
      && programCycle.enrolledOn <= programCycle.endsOn
      && programCycle.withdrawnOn === null
      && programCycle.endsOn < today
    ))
    .map(programCycle => programCycle.program);

  return [...new Set(names)].sort(compareListSortValues);
}
