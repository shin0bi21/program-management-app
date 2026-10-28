// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import {
  getHoursCalendarData,
  getHoursDashboardData,
  getHoursTableData,
  getHoursReferenceData,
  setHours,
  updateHoursPlacement,
} from './hours.api';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('hours API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses explicit view endpoints for calendar and dashboard data', () => {
    const controller = new AbortController();

    getHoursCalendarData(
      {
        staffIds: ['staff-1'], categories: ['meeting'], programIds: ['general', 'program-1'],
        types: ['task', 'other'], cycleId: 'cycle-1', search: 'follow up',
        dateRange: { start: '2026-01-01', end: '2026-12-31' },
      },
      { start: '2026-08-01', end: '2026-08-31' },
      { signal: controller.signal },
    );
    getHoursDashboardData('staff-1', 'cycle-1', { signal: controller.signal });

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      '/hours/calendar?start=2026-08-01&end=2026-08-31&staffIds=staff-1&categories=meeting&programIds=general%2Cprogram-1&types=task%2Cother&cycleId=cycle-1&search=follow+up',
      { signal: controller.signal },
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      '/hours/dashboard?staffId=staff-1&cycleId=cycle-1',
      { signal: controller.signal },
    );
  });

  it('serializes list filters and cursor pagination', () => {
    getHoursTableData({
      staffIds: ['staff-1'],
      categories: ['outreach'],
      programIds: ['program-1'],
      types: ['task'],
      cycleId: 'cycle-1',
      search: 'follow up',
      dateRange: { start: '2026-02-01', end: '2026-04-30' },
    }, undefined, {
      key: 'date',
      direction: 'desc',
      limit: 25,
      cursor: 'cursor-1',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/hours/table?sort=date&direction=desc&limit=25&cursor=cursor-1&staffIds=staff-1&categories=outreach&programIds=program-1&types=task&cycleId=cycle-1&search=follow+up&start=2026-02-01&end=2026-04-30',
      undefined,
    );
  });

  it('clips buffered calendar requests to the applied date range and skips disjoint loads', async () => {
    const filters = {
      staffIds: [], categories: [], programIds: [], types: [], search: '',
      dateRange: { start: '2026-08-01', end: '2026-08-31' },
    };
    getHoursCalendarData(filters, { start: '2026-07-20', end: '2026-08-10' });
    expect(apiClient.get).toHaveBeenCalledWith('/hours/calendar?start=2026-08-01&end=2026-08-10', undefined);

    vi.mocked(apiClient.get).mockClear();
    expect(await getHoursCalendarData(filters, { start: '2026-09-01', end: '2026-09-30' })).toEqual({});
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('loads backend-owned reference data', () => {
    const controller = new AbortController();
    getHoursReferenceData({ signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/hours/reference-data',
      { signal: controller.signal },
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

    expect(apiClient.post).toHaveBeenCalledWith('/hours', input);
    expect(apiClient.put).toHaveBeenCalledWith('/hours/entry-1', input);
    expect(apiClient.patch).toHaveBeenCalledWith('/hours/entry-1/placement', {
      workDate: '2026-08-20',
    });
  });
});
