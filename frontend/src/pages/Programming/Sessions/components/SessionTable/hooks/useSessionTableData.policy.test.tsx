import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ProgramSession, SessionSortKey } from '../../../types';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import { useSessionTableData } from './useSessionTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row = makeProgramSession();

const sortValues: Array<[SessionSortKey, Partial<ProgramSession>, string | Date]> = [
  ['program', { programName: 'Other' }, 'other'],
  ['cycle', { cycleName: 'Other' }, 'other'],
  ['theme', { theme: 'Other' }, 'other'],
  ['date', { startsAt: '2027-01-01T12:00:00Z' }, new Date('2027-01-01T12:00:00Z')],
  ['time', { startsAt: '2027-01-01T12:00:00Z' }, new Date('2027-01-01T12:00:00Z')],
  ['type', { sessionType: 'Field Trip' }, 'field trip'],
  ['status', { state: 'cancelled' }, 'cancelled'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  renderHook(() => useSessionTableData(['sessions', 'table'], {}, { key, direction: 'asc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<ProgramSession>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).toEqual(expected);
});

it('compares timestamp instants independently of their serialized offset', () => {
  renderHook(() => useSessionTableData(['sessions', 'table'], {}, { key: 'date', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<ProgramSession>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, startsAt: '2026-10-01T12:00:00Z' })).toEqual(getValue({ ...row, startsAt: '2026-10-01T08:00:00-04:00' }));
});
