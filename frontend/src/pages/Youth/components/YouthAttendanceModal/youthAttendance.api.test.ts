// @vitest-environment node
// Owns youth-attendance API paths, request options, and mutation payloads.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../http/client';
import { getYouthCohortAttendance, setYouthCohortAttendance } from './youthAttendance.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

describe('youth attendance API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads cohort attendance with and without request options', () => {
    const controller = new AbortController();

    getYouthCohortAttendance('youth-1', 'cohort-1');
    getYouthCohortAttendance('youth-1', 'cohort-1', { signal: controller.signal });

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      '/youth/youth-1/cohorts/cohort-1/attendance',
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      '/youth/youth-1/cohorts/cohort-1/attendance',
      { signal: controller.signal },
    );
  });

  it('replaces attendance through the exact records payload', () => {
    const records = [{ sessionId: 'session-1', status: 'present' as const, notes: 'Joined late.' }];

    setYouthCohortAttendance('youth-1', 'cohort-1', records);

    expect(apiClient.put).toHaveBeenCalledWith(
      '/youth/youth-1/cohorts/cohort-1/attendance',
      { records },
    );
  });
});
