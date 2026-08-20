// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';

import {
  deleteTask,
  getTaskList,
  getTasks,
  setTask,
  updateTaskPlacement,
  updateTaskStatus,
} from './tasks.api';
import type { SetTaskInput } from './types';

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

  it('serializes calendar filters and request options', () => {
    const controller = new AbortController();
    getTasks({
      staffId: 'staff-1',
      category: 'planning_prep',
      start: '2026-08-10',
      end: '2026-08-12',
      includeClosed: true,
    }, { signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks?staffId=staff-1&category=planning_prep&start=2026-08-10&end=2026-08-12&includeClosed=true',
      { signal: controller.signal },
    );
  });

  it('serializes list filters, derived timing states, and cursor pagination', () => {
    getTaskList({
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
    updateTaskStatus('task-1', 'completed');
    updateTaskPlacement('task-1', {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    });
    deleteTask('task-1');

    expect(apiClient.patch).toHaveBeenNthCalledWith(1, '/tasks/task-1/status', { status: 'completed' });
    expect(apiClient.patch).toHaveBeenNthCalledWith(2, '/tasks/task-1/placement', {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/tasks/task-1');
  });
});
