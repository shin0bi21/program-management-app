// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../http/client';

import {
  deleteTask,
  getOpenTasks,
  getTaskReferenceData,
  setTask,
  type SetTaskInput,
  updateTaskPlacement,
  updateTaskState,
} from './tasks.api';

vi.mock('../../../../http/client', () => ({
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

  it('loads shared open tasks for one staff member', () => {
    const controller = new AbortController();

    getOpenTasks('staff-1', { signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks?staffId=staff-1',
      { signal: controller.signal },
    );
  });

  it('loads all task reference data in one request', () => {
    const controller = new AbortController();
    getTaskReferenceData({ signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/tasks/reference-data',
      { signal: controller.signal },
    );
  });

  it('uses separate create and update task commands', () => {
    setTask(input);
    setTask(input, 'task-1');

    expect(apiClient.post).toHaveBeenCalledWith('/tasks', input);
    expect(apiClient.put).toHaveBeenCalledWith('/tasks/task-1', input);
  });

  it('sends narrow lifecycle and delete commands', () => {
    updateTaskState('task-1', 'completed');
    deleteTask('task-1');

    expect(apiClient.patch).toHaveBeenCalledWith('/tasks/task-1/state', { state: 'completed' });
    expect(apiClient.delete).toHaveBeenCalledWith('/tasks/task-1');
  });

  it('patches task dates and reassignment through the placement endpoint', () => {
    const placement = {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    };

    updateTaskPlacement('task-1', placement);

    expect(apiClient.patch).toHaveBeenCalledWith('/tasks/task-1/placement', placement);
  });
});
