import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enrollYouth } from '../../../../../../common/features/programming/api/programming.api';
import { useEnrollYouthSubmit } from './useEnrollYouthSubmit';

vi.mock('../../../../../../common/features/programming/api/programming.api', () => ({
  enrollYouth: vi.fn(),
}));

describe('useEnrollYouthSubmit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owns the enrollment submission lifecycle', async () => {
    let completeEnrollment: () => void = () => {};
    vi.mocked(enrollYouth).mockReturnValue(new Promise((resolve) => {
      completeEnrollment = () => resolve([]);
    }));
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnrollYouthSubmit({
      cohortId: 'cohort-1',
      selectedYouthIds: ['youth-1', 'youth-2'],
      onSuccess,
    }));

    act(() => {
      void result.current.submit();
      void result.current.submit();
    });
    expect(result.current.submitStatus).toBe('submitting');
    expect(enrollYouth).toHaveBeenCalledOnce();
    expect(enrollYouth).toHaveBeenCalledWith('cohort-1', {
      youthIds: ['youth-1', 'youth-2'],
    });

    await act(async () => completeEnrollment());
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('surfaces request errors and resets status for a different cohort', async () => {
    vi.mocked(enrollYouth).mockRejectedValue(new Error('Enrollment failed'));
    const { result, rerender } = renderHook(
      ({ cohortId }: { cohortId?: string }) => useEnrollYouthSubmit({
        cohortId,
        selectedYouthIds: ['youth-1'],
        onSuccess: vi.fn(),
      }),
      { initialProps: { cohortId: 'cohort-1' } },
    );

    await act(() => result.current.submit());
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.submitError).toBe('Enrollment failed');

    rerender({ cohortId: 'cohort-2' });
    await waitFor(() => expect(result.current.submitStatus).toBe('idle'));
    expect(result.current.submitError).toBeNull();
  });
});
