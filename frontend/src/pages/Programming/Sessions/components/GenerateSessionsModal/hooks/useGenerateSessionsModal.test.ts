import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateSessions,
  getSessionTypes,
} from '../../../sessions.api';
import type { ProgramCohort } from '../../../../Cohorts/types';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../../tests/queryClientTestUtils';
import useGenerateSessionsModal from './useGenerateSessionsModal';

vi.mock('../../../sessions.api', () => ({
  generateSessions: vi.fn(),
  getSessionTypes: vi.fn(),
}));

const regularTypeId = '00000000-0000-4000-8000-000000000001';
const cohort: ProgramCohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-summer-2026',
  cycleName: 'Summer 2026',
  name: 'Summer 2026',
  startsOn: '2026-07-01',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 5,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

function wrapper() {
  return createQueryClientWrapper(createTestQueryClient());
}

function setRequiredDraft(
  result: { current: ReturnType<typeof useGenerateSessionsModal> },
) {
  act(() => {
    result.current.updateDraft('theme', '  Communication  ');
    result.current.updateDraft('sessionTypeId', regularTypeId);
  });
}

describe('useGenerateSessionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionTypes).mockResolvedValue([{ id: regularTypeId, name: 'Regular' }]);
    vi.mocked(generateSessions).mockResolvedValue({ sessions: [{ id: 'session-1' }] });
  });

  it('submits the normalized weekly schedule and reports refreshed success', async () => {
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useGenerateSessionsModal({
      cohort,
      cohorts: [],
      open: true,
      onSuccess,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.sessionTypes).toHaveLength(1));
    setRequiredDraft(result);

    await act(async () => result.current.submit());

    expect(generateSessions).toHaveBeenCalledWith(cohort.id, {
      sessionTypeId: regularTypeId,
      theme: 'Communication',
      frequency: 'weekly',
      dayOfWeek: 'tuesday',
      startsOn: cohort.startsOn,
      endsOn: cohort.endsOn,
      startTime: '17:00',
      endTime: '19:30',
    });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('builds only the fields used by monthly and one-time schedules', async () => {
    const { result } = renderHook(() => useGenerateSessionsModal({
      cohort,
      cohorts: [],
      open: true,
      onSuccess: vi.fn(),
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.sessionTypes).toHaveLength(1));
    setRequiredDraft(result);

    act(() => {
      result.current.updateDraft('frequency', 'monthly');
      result.current.updateDraft('dayOfMonth', '15');
    });
    await act(async () => result.current.submit());
    expect(generateSessions).toHaveBeenLastCalledWith(cohort.id, expect.objectContaining({
      frequency: 'monthly',
      dayOfMonth: 15,
    }));
    expect(generateSessions).toHaveBeenLastCalledWith(
      cohort.id,
      expect.not.objectContaining({ dayOfWeek: expect.anything() }),
    );

    const reopened = renderHook(() => useGenerateSessionsModal({
      cohort,
      cohorts: [],
      open: true,
      onSuccess: vi.fn(),
    }), { wrapper: wrapper() });
    await waitFor(() => expect(reopened.result.current.sessionTypes).toHaveLength(1));
    setRequiredDraft(reopened.result);
    act(() => reopened.result.current.updateDraft('frequency', 'once'));
    await act(async () => reopened.result.current.submit());
    expect(generateSessions).toHaveBeenLastCalledWith(
      cohort.id,
      expect.not.objectContaining({
        dayOfWeek: expect.anything(),
        dayOfMonth: expect.anything(),
        endsOn: expect.anything(),
      }),
    );
  });

  it('preserves a draft when the same cohort record is recreated', () => {
    const options = {
      cohort,
      cohorts: [] as ProgramCohort[],
      open: true,
      onSuccess: vi.fn(),
    };
    const { result, rerender } = renderHook(
      (props: typeof options) => useGenerateSessionsModal(props),
      { initialProps: options, wrapper: wrapper() },
    );
    act(() => result.current.updateDraft('theme', 'Keep this draft'));

    rerender({ ...options, cohort: { ...cohort } });

    expect(result.current.draft.theme).toBe('Keep this draft');
  });

  it('starts a fresh schedule when the cohort target changes', () => {
    const nextCohort = {
      ...cohort,
      id: 'cohort-2',
      name: 'Fall 2026',
      startsOn: '2026-09-01',
      endsOn: '2026-11-30',
    };
    const options = {
      cohort,
      cohorts: [] as ProgramCohort[],
      open: true,
      onSuccess: vi.fn(),
    };
    const { result, rerender } = renderHook(
      (props: typeof options) => useGenerateSessionsModal(props),
      { initialProps: options, wrapper: wrapper() },
    );
    act(() => result.current.updateDraft('theme', 'Old draft'));

    rerender({ ...options, cohort: nextCohort });

    expect(result.current.draft.theme).toBe('');
    expect(result.current.draft.startsOn).toBe(nextCohort.startsOn);
    expect(result.current.draft.endsOn).toBe(nextCohort.endsOn);
  });

  it('rejects missing required fields before calling the API', async () => {
    const { result } = renderHook(() => useGenerateSessionsModal({
      cohort,
      cohorts: [],
      open: true,
      onSuccess: vi.fn(),
    }), { wrapper: wrapper() });

    await act(async () => result.current.submit());

    expect(generateSessions).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Complete all required session fields.');
  });

  it('keeps generated sessions successful and non-retryable when refresh fails', async () => {
    const { result } = renderHook(() => useGenerateSessionsModal({
      cohort,
      cohorts: [],
      open: true,
      onSuccess: vi.fn().mockRejectedValue(new Error('Refresh failed')),
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.sessionTypes).toHaveLength(1));
    setRequiredDraft(result);

    await act(async () => result.current.submit());
    await act(async () => result.current.submit());

    expect(generateSessions).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toContain('page could not refresh');
  });

  it('reports a generation failure and allows retry', async () => {
    vi.mocked(generateSessions).mockRejectedValueOnce(new Error('Generation failed'));
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useGenerateSessionsModal({
      cohort,
      cohorts: [],
      open: true,
      onSuccess,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.sessionTypes).toHaveLength(1));
    setRequiredDraft(result);

    await act(async () => result.current.submit());
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Generation failed');
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => result.current.submit());
    expect(generateSessions).toHaveBeenCalledTimes(2);
    expect(result.current.submitStatus).toBe('success');
  });
});
