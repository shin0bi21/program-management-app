import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { TasksFilters } from '../../../tasks.api';
import type { Task, TaskSortKey } from '../../../types';
import { makeTask } from '../../../../../../tests/factories/task';
import useTaskTableData from './useTaskTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row = makeTask();

const sortValues: Array<[TaskSortKey, Partial<Task>, string]> = [
  ['firstName', { assignee: { ...row.assignee, firstName: 'Other' } }, 'other'],
  ['lastName', { assignee: { ...row.assignee, lastName: 'Other' } }, 'other'],
  ['title', { title: 'Other' }, 'other'],
  ['category', { category: 'meeting' }, 'meeting'],
  ['program', { programName: 'Other' }, 'other'],
  ['startDate', { startDate: '2027-01-01' }, '2027-01-01'],
  ['dueDate', { dueDate: '2027-01-01' }, '2027-01-01'],
  ['status', { status: 'cancelled' }, 'cancelled'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  const filters: TasksFilters = { cycleIds: [], staffIds: [], programIds: [], categories: [], statuses: [], search: '' };
  renderHook(() => useTaskTableData(['tasks', 'table'], filters, { key, direction: 'asc' }, '2026-10-01'));
  const getValue = vi.mocked(useInfiniteListQuery<Task>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).toEqual(expected);
});
