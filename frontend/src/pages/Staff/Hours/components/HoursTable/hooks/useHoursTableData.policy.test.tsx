import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { HoursTableRow, HoursFilters, HoursSortKey } from '../../../types';
import { makeHoursItem } from '../../../../../../tests/factories/hours';
import useHoursTableData from './useHoursTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row: HoursTableRow = {
  id: 'hours-1', resourceId: 'staff-1', date: '2026-10-01', staffFirstName: 'Avery', staffLastName: 'Youth',
  staffName: 'Avery Youth', item: makeHoursItem({ taskId: null, sessionId: null }),
};

const sortValues: Array<[HoursSortKey, Partial<HoursTableRow>, string | number]> = [
  ['firstName', { staffFirstName: 'Other' }, 'other'],
  ['lastName', { staffLastName: 'Other' }, 'other'],
  ['date', { date: '2026-10-02' }, '2026-10-02'],
  ['program', { item: { ...row.item, programName: 'Other' } }, 'other'],
  ['cycle', { item: { ...row.item, cycleName: 'Other' } }, 'other'],
  ['category', { item: { ...row.item, category: 'other' } }, 'other'],
  ['hours', { item: { ...row.item, hours: 10.5 } }, 10.5],
  ['note', { item: { ...row.item, note: 'Other' } }, 'other'],
  ['type', { item: { ...row.item, taskId: 'task-1' } }, 'task'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  const filters: HoursFilters = { staffIds: [], categories: [], programIds: [], types: [], search: '' };
  renderHook(() => useHoursTableData(['hours', 'table'], filters, { key, direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<HoursTableRow>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).toEqual(expected);
});
