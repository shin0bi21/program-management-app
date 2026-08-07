import { describe, expect, it } from 'vitest';
import type { ProgramCohort } from '../../../../common/types/cohort';
import type { Program } from '../../../../features/programs/types';
import {
  getSingleActiveCohort,
  getSingleAssignedProgram,
} from './staffProgrammingDefaults';

const programs: Program[] = [
  {
    id: 'soft-skills',
    name: 'Soft Skills',
    description: null,
    rosterMode: 'enrolled',
    minAge: 12,
    maxAge: 15,
  },
  {
    id: 'drop-in',
    name: 'Drop In',
    description: null,
    rosterMode: 'open',
    minAge: null,
    maxAge: null,
  },
];

const activeCohort: ProgramCohort = {
  id: 'summer-2026',
  programId: 'soft-skills',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  name: 'Summer 2026',
  startsOn: '2026-07-01',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 0,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

describe('staff programming defaults', () => {
  it('uses one assigned enrolled program without counting open attendance', () => {
    expect(getSingleAssignedProgram('staff', programs)).toEqual(programs[0]);
    expect(getSingleAssignedProgram('admin', programs)).toBeNull();
  });

  it('does not choose a default when staff has multiple assigned programs', () => {
    expect(getSingleAssignedProgram('staff', [
      ...programs,
      { ...programs[0], id: 'job-readiness', name: 'Job Readiness' },
    ])).toBeNull();
  });

  it('uses a cohort only when exactly one matching cohort is active', () => {
    expect(getSingleActiveCohort([activeCohort], 'soft-skills')).toEqual(activeCohort);
    expect(getSingleActiveCohort([
      activeCohort,
      { ...activeCohort, id: 'fall-2026', name: 'Fall 2026' },
    ], 'soft-skills')).toBeNull();
  });
});
