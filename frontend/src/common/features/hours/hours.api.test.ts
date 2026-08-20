import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import { getHoursList, setHours, updateHoursPlacement } from './hours.api';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('time-entry API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes list filters and cursor pagination', () => {
    getHoursList({
      staffIds: ['staff-1'],
      categories: ['outreach'],
      programIds: ['program-1'],
      types: ['task'],
      cycleId: 'cycle-1',
      search: 'follow up',
    }, undefined, {
      key: 'date',
      direction: 'desc',
      limit: 25,
      cursor: 'cursor-1',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/time-entries/list?sort=date&direction=desc&limit=25&cursor=cursor-1&staffIds=staff-1&categories=outreach&programIds=program-1&types=task&cycleId=cycle-1&search=follow+up',
      undefined,
    );
  });

  it('uses create, update, and placement endpoints without widening their commands', () => {
    const input = {
      source: 'task' as const,
      staffId: 'staff-1',
      workDate: '2026-08-19',
      taskId: 'task-1',
      hours: 2,
      note: '',
    };

    setHours(input);
    setHours(input, 'entry-1');
    updateHoursPlacement('entry-1', { workDate: '2026-08-20' });

    expect(apiClient.post).toHaveBeenCalledWith('/time-entries', input);
    expect(apiClient.put).toHaveBeenCalledWith('/time-entries/entry-1', input);
    expect(apiClient.patch).toHaveBeenCalledWith('/time-entries/entry-1/placement', {
      workDate: '2026-08-20',
    });
  });
});

// @vitest-environment node
