// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';

import {
  deleteTask,
  getTask,
  getTaskDashboardData,
  getTaskReferenceData,
  getTasksCalendarData,
  getTasksTableData,
  setTask,
  type SetTaskInput,
  updateTaskPlacement,
  updateTaskState,
} from './tasks.api';

vi.mock('../../../http/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const input: SetTaskInput = {
  title: 'Prepare workshop',
  details: null,
  category: 'planning_prep',
  programId: null,
  startDate: '2026-08-10',
  dueDate: '2026-08-12',
  staffId: 'staff-1',
};

describe('tasks API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads an authoritative task by id with cancellation', () => {
    const controller = new AbortController();
    getTask('task-1', { signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith('/tasks/task-1', { signal: controller.signal });
  });

  it('loads open dashboard tasks for one staff member', () => {
    const controller = new AbortController();

    getTaskDashboardData('staff-1', { signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks?staffId=staff-1',
      { signal: controller.signal },
    );
  });

  it('serializes shared filters for calendar range data', () => {
    getTasksCalendarData({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['active', 'overdue'],
      search: 'workshop prep',
    }, { start: '2026-08-10', end: '2026-08-12' });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks/calendar?start=2026-08-10&end=2026-08-12&staffIds=staff-1&programIds=program-1&categories=planning_prep&statuses=active%2Coverdue&search=workshop+prep',
      undefined,
    );
  });

  it('uses the applied page range for table requests and the visible range for calendar requests', () => {
    const filters = {
      staffIds: [], programIds: [], categories: [], statuses: [], search: '',
      dateRange: { start: '2026-01-01', end: '2026-12-31' },
    };
    getTasksTableData(filters, undefined, { key: 'startDate', direction: 'asc' });
    getTasksCalendarData(filters, { start: '2026-08-10', end: '2026-08-12' });

    expect(apiClient.get).toHaveBeenNthCalledWith(1,
      '/tasks/list?sort=startDate&direction=asc&limit=50&start=2026-01-01&end=2026-12-31', undefined);
    expect(apiClient.get).toHaveBeenNthCalledWith(2,
      '/tasks/calendar?start=2026-08-10&end=2026-08-12', undefined);
  });

  it('clips buffered requests to the page range and skips requests entirely outside it', async () => {
    const filters = {
      staffIds: [], programIds: [], categories: [], statuses: [], search: '',
      dateRange: { start: '2026-08-01', end: '2026-08-31' },
    };
    getTasksCalendarData(filters, { start: '2026-07-15', end: '2026-09-15' });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks/calendar?start=2026-08-01&end=2026-08-31', undefined);
    vi.mocked(apiClient.get).mockClear();

    await expect(getTasksCalendarData(filters, { start: '2026-09-01', end: '2026-09-15' })).resolves.toEqual([]);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('loads all task reference data in one request', () => {
    const controller = new AbortController();
    getTaskReferenceData({ signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks/reference-data',
      { signal: controller.signal },
    );
  });

  it('serializes list filters, derived timing states, and cursor pagination', () => {
    getTasksTableData({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['active', 'overdue'],
      search: 'workshop prep',
    }, undefined, {
      key: 'dueDate',
      direction: 'desc',
      limit: 50,
      cursor: 'cursor-1',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks/list?sort=dueDate&direction=desc&limit=50&cursor=cursor-1&staffIds=staff-1&programIds=program-1&categories=planning_prep&statuses=active%2Coverdue&search=workshop+prep',
      undefined,
    );
  });

  it('uses separate create and update task commands', () => {
    setTask(input);
    setTask(input, 'task-1');

    expect(apiClient.post).toHaveBeenCalledWith('/tasks', input);
    expect(apiClient.put).toHaveBeenCalledWith('/tasks/task-1', input);
  });

  it('sends narrow lifecycle, placement, and delete commands', () => {
    updateTaskState('task-1', 'completed');
    updateTaskPlacement('task-1', {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    });
    deleteTask('task-1');

    expect(apiClient.patch).toHaveBeenNthCalledWith(1, '/tasks/task-1/state', { state: 'completed' });
    expect(apiClient.patch).toHaveBeenNthCalledWith(2, '/tasks/task-1/placement', {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/tasks/task-1');
  });
});
