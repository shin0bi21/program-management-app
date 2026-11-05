// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import type { YouthProfile } from '../../types';
import { getActiveProgramLabels, getCompletedProgramLabels } from './programColumns';

const enrollment: YouthProfile['programCycles'][number] = {
  programId: 'skills', programName: 'Skills', cycleId: 'fall', cycleName: 'Fall 2026',
  enrollmentRequired: true, startsOn: '2026-09-01', endsOn: '2026-11-04',
  enrolledOn: '2026-09-01', withdrawnOn: null,
  presentCount: 0, lateCount: 0, absentCount: 0, lastAttendedOn: null,
};

describe('youth program columns', () => {
  it('includes only current enrollments and deduplicates programs across cycles', () => {
    const profile = makeYouthProfile({ programCycles: [
      enrollment,
      { ...enrollment, cycleId: 'other', cycleName: 'Other cycle' },
      { ...enrollment, programName: 'Starts today', startsOn: '2026-11-04', enrolledOn: '2026-11-04' },
      { ...enrollment, programName: 'Withdraws later', endsOn: '2026-12-31', withdrawnOn: '2026-11-05' },
      { ...enrollment, programName: 'Open program', enrollmentRequired: false },
      { ...enrollment, programName: 'Attendance only', enrolledOn: null },
      { ...enrollment, programName: 'Future cycle', startsOn: '2026-11-05', endsOn: '2026-12-31' },
      { ...enrollment, programName: 'Ended cycle', endsOn: '2026-11-03' },
      { ...enrollment, programName: 'Future enrollment', enrolledOn: '2026-11-05' },
      { ...enrollment, programName: 'Withdrawn today', withdrawnOn: '2026-11-04' },
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
      { ...enrollment, cycleId: 'previous', cycleName: 'Previous cycle' },
      { ...enrollment, programName: 'Withdrawn', withdrawnOn: '2026-10-01' },
      { ...enrollment, programName: 'Open program', enrollmentRequired: false },
      { ...enrollment, programName: 'Attendance only', enrolledOn: null },
      { ...enrollment, programName: 'Ends today', endsOn: '2026-11-05' },
      { ...enrollment, programName: 'Future cycle', startsOn: '2027-01-01', endsOn: '2027-12-31' },
      { ...enrollment, programName: 'Enrolled after end', enrolledOn: '2026-11-05' },
    ] });

    expect(getCompletedProgramLabels(profile, '2026-11-05')).toEqual(['Skills']);
  });
});
