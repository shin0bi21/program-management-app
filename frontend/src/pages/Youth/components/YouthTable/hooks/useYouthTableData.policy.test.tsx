import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import type { YouthProfile, YouthFilters, YouthSortKey } from '../../../types';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import useYouthTableData from './useYouthTableData';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const participation: YouthProfile['programCycles'][number] = {
  cycleId: 'cycle-1', cycleName: 'Fall', programId: 'program-1', programName: 'Skills', enrollmentRequired: true,
  startsOn: '2026-09-01', endsOn: '2026-12-31', enrolledOn: '2026-09-01', withdrawnOn: null,
  presentCount: 1, lateCount: 0, absentCount: 0, lastAttendedOn: '2026-10-01',
};
const row = makeYouthProfile({ programCycles: [participation] });

const sortChanges: Array<[YouthSortKey, Partial<YouthProfile>]> = [
  ['firstName', { firstName: 'Other' }],
  ['lastName', { lastName: 'Other' }],
  ['dateOfBirth', { dateOfBirth: '2012-01-01' }],
  ['school', { schoolName: 'Other' }],
  ['program', { programCycles: [{ ...participation, programName: 'Other' }] }],
  ['status', { status: 'inactive' }],
];

it.each(sortChanges)('maps %s to its canonical sort value and ignores unrelated edits', (key, changes) => {
  const filters: YouthFilters = {};
  renderHook(() => useYouthTableData(filters, { key, direction: 'asc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<YouthProfile>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).not.toEqual(getValue(row));
  expect(getValue({ ...row, contacts: [{ id: 'contact', phoneNumber: '4165550100', type: 'parent' }] })).toEqual(getValue(row));
});

it('ignores active filter and search changes outside the sort column', () => {
  const filters: YouthFilters = { programIds: ['program-1'], cycleIds: ['cycle-1'], search: 'skills' };
  const key: YouthSortKey = sortChanges[0][0];
  renderHook(() => useYouthTableData(filters, { key, direction: 'desc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<YouthProfile>).mock.calls[0][0].ordering!.getValue;
  const changedRows: YouthProfile[] = [{ ...row, schoolName: 'Other' }, { ...row, programCycles: [{ ...participation, cycleId: 'other' }] }, { ...row, programCycles: [{ ...participation, programId: 'other' }] }, { ...row, programCycles: [{ ...participation, withdrawnOn: '2026-10-02' }] }];

  for (const changed of changedRows) expect(getValue(changed)).toEqual(getValue(row));
  expect(getValue({ ...row, contacts: [{ id: 'contact', phoneNumber: '4165550100', type: 'parent' }] })).toEqual(getValue(row));
});

it('uses the first raw program name among current enrollments before case normalization', () => {
  renderHook(() => useYouthTableData({}, { key: 'program', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<YouthProfile>).mock.calls[0][0].ordering!.getValue;
  const programCycles = [
    { ...participation, programName: 'apple' },
    { ...participation, programName: 'Zoo' },
    { ...participation, programName: 'Aged out', withdrawnOn: '2026-10-02' },
    { ...participation, programName: 'Attended only', enrolledOn: null },
  ];

  expect(getValue({ ...row, programCycles })).toBe('zoo');
  expect(getValue({ ...row, programCycles: [] })).toBe('');
  expect(getValue({ ...row, programCycles: [{ ...participation, programName: '\u{10000}' }, { ...participation, programName: '\ue000' }] })).toBe('\ue000');
});

it('normalizes nullable school and date values like the server', () => {
  const { rerender } = renderHook(({ key }: { key: YouthSortKey }) => useYouthTableData({}, { key, direction: 'asc' }), {
    initialProps: { key: 'school' as YouthSortKey },
  });
  expect(vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue({ ...row, schoolName: null })).toBe('');

  rerender({ key: 'dateOfBirth' });
  expect(vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue({ ...row, dateOfBirth: null })).toBe('');
});
