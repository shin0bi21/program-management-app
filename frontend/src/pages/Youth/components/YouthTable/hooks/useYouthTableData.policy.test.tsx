import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import type { YouthProfile, YouthSortKey } from '../../../types';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import useYouthTableData from './useYouthTableData';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T15:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const participation: YouthProfile['programCycles'][number] = {
  cycleId: 'cycle-1', cycle: 'Fall', programId: 'program-1', program: 'Skills', enrollmentRequired: true,
  startsOn: '2026-09-01', endsOn: '2026-12-31', enrolledOn: '2026-09-01', withdrawnOn: null,
  presentCount: 1, lateCount: 0, absentCount: 0, lastAttendedOn: '2026-10-01',
};
const row = makeYouthProfile({ programCycles: [participation] });

const sortValues: Array<[YouthSortKey, Partial<YouthProfile>, string]> = [
  ['firstName', { firstName: 'Other' }, 'other'],
  ['lastName', { lastName: 'Other' }, 'other'],
  ['dateOfBirth', { dateOfBirth: '2012-01-01' }, '2012-01-01'],
  ['school', { schoolName: 'Other' }, 'other'],
  ['activePrograms', { programCycles: [{ ...participation, program: 'Other' }] }, 'other'],
  ['completedPrograms', { programCycles: [{ ...participation, endsOn: '2026-11-03' }] }, 'skills'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  renderHook(() => useYouthTableData({}, { key, direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).toEqual(expected);
});

it('uses the first raw program name among current enrollments before case normalization', () => {
  renderHook(() => useYouthTableData({}, { key: 'activePrograms', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue;
  const programCycles = [
    { ...participation, program: 'apple' },
    { ...participation, program: 'Zoo' },
  ];

  expect(getValue({ ...row, programCycles })).toBe('zoo');
  expect(getValue({ ...row, programCycles: [] })).toBe('');
});

it('normalizes nullable school and date values like the server', () => {
  const { rerender } = renderHook(({ key }: { key: YouthSortKey }) => useYouthTableData({}, { key, direction: 'asc' }), {
    initialProps: { key: 'school' as YouthSortKey },
  });
  expect(vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue({ ...row, schoolName: null })).toBe('');

  rerender({ key: 'dateOfBirth' });
  expect(vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue({ ...row, dateOfBirth: null })).toBe('');
});
