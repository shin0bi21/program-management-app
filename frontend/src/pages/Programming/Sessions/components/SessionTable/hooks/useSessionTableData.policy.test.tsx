import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ProgramSession, SessionListFilters, SessionSortKey } from '../../../types';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import { useSessionTableData } from './useSessionTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row = makeProgramSession();

const sortChanges: Array<[SessionSortKey, Partial<ProgramSession>]> = [
  ['program', { programName: 'Other' }],
  ['cycle', { cycleName: 'Other' }],
  ['theme', { theme: 'Other' }],
  ['date', { startsAt: '2027-01-01T12:00:00Z' }],
  ['time', { startsAt: '2027-01-01T12:00:00Z' }],
  ['type', { sessionTypeName: 'Other' }],
  ['status', { state: 'cancelled' }],
];

it.each(sortChanges)('maps %s to its canonical sort value and ignores unrelated edits', (key, changes) => {
  const filters: SessionListFilters = {};
  renderHook(() => useSessionTableData(['sessions', 'table'], filters, { key, direction: 'asc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<ProgramSession>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).not.toEqual(getValue(row));
  expect(getValue({ ...row, attendedCount: row.attendedCount + 1 })).toEqual(getValue(row));
});

it('ignores active filter and search changes outside the sort column', () => {
  const filters: SessionListFilters = { programIds: ['program-1'], cycleIds: ['cycle-1'], sessionTypeIds: ['type-1'], statuses: ['upcoming'], dateRange: { start: '2026-01-01', end: '2026-12-31' }, search: 'work' };
  const key: SessionSortKey = sortChanges[0][0];
  renderHook(() => useSessionTableData(['sessions', 'table'], filters, { key, direction: 'desc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<ProgramSession>).mock.calls[0][0].ordering!.getValue;
  const changedRows: ProgramSession[] = [{ ...row, programId: 'other' }, { ...row, cycleId: 'other' }, { ...row, sessionTypeId: 'other' }, { ...row, description: 'Other' }, { ...row, endsAt: '2027-01-01T12:00:00Z' }];

  for (const changed of changedRows) expect(getValue(changed)).toEqual(getValue(row));
  expect(getValue({ ...row, attendedCount: row.attendedCount + 1 })).toEqual(getValue(row));
});

it('compares timestamp instants independently of their serialized offset', () => {
  renderHook(() => useSessionTableData(['sessions', 'table'], {}, { key: 'date', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<ProgramSession>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, startsAt: '2026-10-01T12:00:00Z' })).toEqual(getValue({ ...row, startsAt: '2026-10-01T08:00:00-04:00' }));
});
