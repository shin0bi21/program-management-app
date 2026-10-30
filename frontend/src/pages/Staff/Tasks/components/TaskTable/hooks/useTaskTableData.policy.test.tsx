import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { Task, TasksFilters, TaskSortKey } from '../../../types';
import { makeTask } from '../../../../../../tests/factories/task';
import useTaskTableData from './useTaskTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row = makeTask();

const sortChanges: Array<[TaskSortKey, Partial<Task>]> = [
  ['firstName', { assignee: { ...row.assignee, firstName: 'Other' } }],
  ['lastName', { assignee: { ...row.assignee, lastName: 'Other' } }],
  ['title', { title: 'Other' }],
  ['category', { category: 'meeting' }],
  ['program', { programName: 'Other' }],
  ['startDate', { startDate: '2027-01-01' }],
  ['dueDate', { dueDate: '2027-01-01' }],
  ['status', { status: 'cancelled' }],
];

it.each(sortChanges)('maps %s to its canonical sort value and ignores unrelated edits', (key, changes) => {
  const filters: TasksFilters = { staffIds: [], programIds: [], categories: [], statuses: [], search: '' };
  renderHook(() => useTaskTableData(['tasks', 'table'], filters, { key, direction: 'asc' }, '2026-10-01'));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<Task>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).not.toEqual(getValue(row));
  expect(getValue({ ...row, hoursLogged: row.hoursLogged + 1 })).toEqual(getValue(row));
});

it('ignores active filter and search changes outside the sort column', () => {
  const filters: TasksFilters = { staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'], statuses: ['in_progress'], dateRange: { start: '2026-01-01', end: '2026-12-31' }, search: 'work' };
  const key: TaskSortKey = sortChanges[0][0];
  renderHook(() => useTaskTableData(['tasks', 'table'], filters, { key, direction: 'desc' }, '2026-10-01'));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<Task>).mock.calls[0][0].ordering!.getValue;
  const changedRows: Task[] = [{ ...row, assignee: { ...row.assignee, id: 'other' } }, { ...row, programId: 'other' }, { ...row, details: 'Other' }, { ...row, dueDate: '2027-01-01' }, { ...row, status: 'cancelled' }];

  for (const changed of changedRows) expect(getValue(changed)).toEqual(getValue(row));
  expect(getValue({ ...row, hoursLogged: row.hoursLogged + 1 })).toEqual(getValue(row));
});
