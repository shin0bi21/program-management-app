// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import type { YouthProfile } from '../../types';
import { getActiveProgramLabels, getCompletedProgramLabels } from './programColumns';

const enrollment: YouthProfile['programCycles'][number] = {
  programId: 'skills', program: 'Skills', cycleId: 'fall', cycle: 'Fall 2026',
  enrollmentRequired: true, startsOn: '2026-09-01', endsOn: '2026-11-04',
  enrolledOn: '2026-09-01', withdrawnOn: null,
  presentCount: 0, lateCount: 0, absentCount: 0, lastAttendedOn: null,
};

describe('youth program columns', () => {
  it('includes only current enrollments and deduplicates programs across cycles', () => {
    const profile = makeYouthProfile({ programCycles: [
      enrollment,
      { ...enrollment, cycleId: 'other', cycle: 'Other cycle' },
      { ...enrollment, program: 'Starts today', startsOn: '2026-11-04', enrolledOn: '2026-11-04' },
      { ...enrollment, program: 'Withdraws later', endsOn: '2026-12-31', withdrawnOn: '2026-11-05' },
      { ...enrollment, program: 'Open program', enrollmentRequired: false },
      { ...enrollment, program: 'Attendance only', enrolledOn: null },
      { ...enrollment, program: 'Future cycle', startsOn: '2026-11-05', endsOn: '2026-12-31' },
      { ...enrollment, program: 'Ended cycle', endsOn: '2026-11-03' },
      { ...enrollment, program: 'Future enrollment', enrolledOn: '2026-11-05' },
      { ...enrollment, program: 'Withdrawn today', withdrawnOn: '2026-11-04' },
    ] });

    expect(getActiveProgramLabels(profile, '2026-11-04')).toEqual([
      'Skills',
      'Starts today',
      'Withdraws later',
    ]);
  });

  it('includes only completed enrollments and deduplicates programs across cycles', () => {
    const profile = makeYouthProfile({ programCycles: [
      enrollment,
      { ...enrollment, cycleId: 'previous', cycle: 'Previous cycle' },
      { ...enrollment, program: 'Withdrawn', withdrawnOn: '2026-10-01' },
      { ...enrollment, program: 'Open program', enrollmentRequired: false },
      { ...enrollment, program: 'Attendance only', enrolledOn: null },
      { ...enrollment, program: 'Ends today', endsOn: '2026-11-05' },
      { ...enrollment, program: 'Future cycle', startsOn: '2027-01-01', endsOn: '2027-12-31' },
      { ...enrollment, program: 'Enrolled after end', enrolledOn: '2026-11-05' },
    ] });

    expect(getCompletedProgramLabels(profile, '2026-11-05')).toEqual(['Skills']);
  });
});
