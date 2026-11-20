// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../../../http/client';
import { getTasksTableData } from './taskTable.api';

vi.mock('../../../../../../http/client', () => ({
  apiClient: { get: vi.fn() },
}));

describe('taskTable API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends filtered cursor and sort inputs with cancellation to the list endpoint', () => {
    const signal = new AbortController().signal;

    getTasksTableData({
      cycleIds: ['cycle-1'],
      staffIds: [],
      programIds: [],
      categories: [],
      statuses: [],
      search: 'workshop prep',
    }, { signal }, { key: 'dueDate', direction: 'desc', cursor: 'cursor-1' });

    const [path, options] = vi.mocked(apiClient.get).mock.lastCall!;
    const url = new URL(path, 'https://example.test');
    expect(url.pathname).toBe('/tasks/list');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sort: 'dueDate',
      direction: 'desc',
      cursor: 'cursor-1',
      cycleIds: 'cycle-1',
      search: 'workshop prep',
    });
    expect(options?.signal).toBe(signal);
  });
});
