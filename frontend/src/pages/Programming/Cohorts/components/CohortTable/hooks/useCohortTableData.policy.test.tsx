import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ProgramCohort, CohortListFilters, CohortSortKey } from '../../../types';
import useCohortTableData from './useCohortTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Skills', enrollmentRequired: true, minAge: null, maxAge: null,
  cycleId: 'cycle-1', cycleName: 'Fall', name: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-31', state: 'active',
  enrolledCount: 1, nextSessionAt: null, nextSessionId: null, averageAttendance: null,
  attendanceAttendedCount: 0, attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};

const sortChanges: Array<[CohortSortKey, Partial<ProgramCohort>]> = [
  ['program', { programName: 'Other' }],
  ['cohort', { name: 'Other' }],
  ['start', { startsOn: '2027-01-01' }],
  ['end', { endsOn: '2027-01-01' }],
  ['status', { state: 'completed' }],
];

it.each(sortChanges)('maps %s to its canonical sort value and ignores unrelated edits', (key, changes) => {
  const filters: CohortListFilters = {};
  renderHook(() => useCohortTableData(['cohorts', 'table'], filters, { key, direction: 'asc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<ProgramCohort>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).not.toEqual(getValue(row));
  expect(getValue({ ...row, enrolledCount: row.enrolledCount + 1 })).toEqual(getValue(row));
});

it('ignores active filter and search changes outside the sort column', () => {
  const filters: CohortListFilters = { programId: 'program-1', status: 'active', search: 'fall' };
  const key: CohortSortKey = sortChanges[0][0];
  renderHook(() => useCohortTableData(['cohorts', 'table'], filters, { key, direction: 'desc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<ProgramCohort>).mock.calls[0][0].ordering!.getValue;
  const changedRows: ProgramCohort[] = [{ ...row, programId: 'other' }, { ...row, state: 'completed' }, { ...row, name: 'Other' }];

  for (const changed of changedRows) expect(getValue(changed)).toEqual(getValue(row));
  expect(getValue({ ...row, enrolledCount: row.enrolledCount + 1 })).toEqual(getValue(row));
});
