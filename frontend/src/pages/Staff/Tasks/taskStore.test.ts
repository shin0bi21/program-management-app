// @vitest-environment node
import { expect, it } from 'vitest';
import type { Task, TaskSortKey } from './types';
import { makeTask } from '../../../tests/factories/task';
import { getTaskSortValue } from './taskStore';

const row = makeTask();

const sortValues: Array<[TaskSortKey, Partial<Task>, string]> = [
  ['firstName', { assignee: { ...row.assignee, firstName: 'Other' } }, 'other'],
  ['lastName', { assignee: { ...row.assignee, lastName: 'Other' } }, 'other'],
  ['title', { title: 'Other' }, 'other'],
  ['category', { category: 'meeting' }, 'meeting'],
  ['program', { program: 'Other' }, 'other'],
  ['startDate', { startDate: '2027-01-01' }, '2027-01-01'],
  ['dueDate', { dueDate: '2027-01-01' }, '2027-01-01'],
  ['status', { status: 'cancelled' }, 'cancelled'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  expect(getTaskSortValue({ ...row, ...changes }, key)).toEqual(expected);
});
