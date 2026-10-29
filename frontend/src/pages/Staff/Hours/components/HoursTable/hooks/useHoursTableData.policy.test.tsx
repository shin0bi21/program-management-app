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

const sortChanges: Array<[HoursSortKey, Partial<HoursTableRow>]> = [
  ['firstName', { staffFirstName: 'Other' }],
  ['lastName', { staffLastName: 'Other' }],
  ['date', { date: '2026-10-02' }],
  ['program', { item: { ...row.item, programName: 'Other' } }],
  ['cycle', { item: { ...row.item, cycleName: 'Other' } }],
  ['category', { item: { ...row.item, category: 'other' } }],
  ['hours', { item: { ...row.item, hours: 50 } }],
  ['note', { item: { ...row.item, note: 'Other' } }],
  ['type', { item: { ...row.item, taskId: 'task-1' } }],
];

it.each(sortChanges)('maps %s to its canonical sort value and ignores unrelated edits', (key, changes) => {
  const filters: HoursFilters = { staffIds: [], categories: [], programIds: [], types: [], search: '' };
  renderHook(() => useHoursTableData(['hours', 'table'], filters, { key, direction: 'asc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<HoursTableRow>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).not.toEqual(getValue(row));
  expect(getValue({ ...row, item: { ...row.item, categoryLabel: 'Different label' } })).toEqual(getValue(row));
});

it('ignores active filter and search changes outside the sort column', () => {
  const filters: HoursFilters = { staffIds: ['staff-1'], categories: ['meeting'], programIds: ['program-1'], types: ['task'], cycleIds: ['cycle-1'], dateRange: { start: '2026-01-01', end: '2026-12-31' }, search: 'work' };
  const key: HoursSortKey = sortChanges[0][0];
  renderHook(() => useHoursTableData(['hours', 'table'], filters, { key, direction: 'desc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<HoursTableRow>).mock.calls[0][0].ordering!.getValue;
  const changedRows: HoursTableRow[] = [{ ...row, resourceId: 'other' }, { ...row, date: '2026-10-02' }, { ...row, item: { ...row.item, programId: 'other' } }, { ...row, item: { ...row.item, cycleId: 'other' } }, { ...row, item: { ...row.item, note: 'Other' } }];

  for (const changed of changedRows) expect(getValue(changed)).toEqual(getValue(row));
  expect(getValue({ ...row, item: { ...row.item, categoryLabel: 'Different label' } })).toEqual(getValue(row));
});

it('supplies hours as a number instead of a formatted text value', () => {
  const filters: HoursFilters = { staffIds: [], categories: [], programIds: [], types: [], search: '' };
  renderHook(() => useHoursTableData(['hours', 'table'], filters, { key: 'hours', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<HoursTableRow>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, item: { ...row.item, hours: 10.5 } })).toBe(10.5);
});
