// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../../../http/client';
import { getTasksCalendarData, updateTaskPlacement } from './taskCalendar.api';

vi.mock('../../../../../../http/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
}));

describe('taskCalendar API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends filtered calendar bounds and cancellation to the calendar endpoint', () => {
    const signal = new AbortController().signal;

    getTasksCalendarData({
      cycleIds: ['cycle-1'],
      staffIds: ['staff-1'],
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['in_progress', 'overdue'],
      search: 'workshop prep',
    }, { start: '2026-08-10', end: '2026-08-12' }, { signal });

    const [path, options] = vi.mocked(apiClient.get).mock.lastCall!;
    const url = new URL(path, 'https://example.test');
    expect(url.pathname).toBe('/tasks/calendar');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      start: '2026-08-10',
      end: '2026-08-12',
      cycleIds: 'cycle-1',
      staffIds: 'staff-1',
      programIds: 'program-1',
      categories: 'planning_prep',
      statuses: 'in_progress,overdue',
      search: 'workshop prep',
    });
    expect(options?.signal).toBe(signal);
  });

  it('patches task dates and reassignment through the placement endpoint', () => {
    const input = {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    };

    updateTaskPlacement('task-1', input);

    expect(apiClient.patch).toHaveBeenCalledWith('/tasks/task-1/placement', input);
  });
});
