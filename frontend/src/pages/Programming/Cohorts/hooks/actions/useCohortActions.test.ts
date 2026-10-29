import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import type { ProgramCohort } from '../../types';
import useCohortActions from './useCohortActions';

const api = vi.hoisted(() => ({ deleteCohort: vi.fn() }));
vi.mock('../../cohorts.api', () => ({
  deleteCohort: api.deleteCohort,
}));

describe('useCohortActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the requested cohort and reconciles selection', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const onCohortRemoved = vi.fn();
    api.deleteCohort.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useCohortActions({ tableQueryKey: ['cohorts', 'table'], onCohortRemoved }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    act(() => result.current.requestDelete({
      id: 'cohort-1', programName: 'Program', name: 'Summer',
    } as ProgramCohort));
    await act(() => result.current.confirmAction!.onConfirm());

    expect(api.deleteCohort).toHaveBeenCalledWith('cohort-1');
    expect(onCohortRemoved).toHaveBeenCalledWith('cohort-1');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cohorts', 'options'] });
  });

  it('refreshes the cohort table, options, and youth queries for roster changes', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const { result } = renderHook(
      () => useCohortActions({ tableQueryKey: ['cohorts', 'table'], onCohortRemoved: vi.fn() }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await act(() => result.current.refreshRoster());

    expect(invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(expect.arrayContaining([
      ['cohorts', 'table'],
      ['cohorts', 'options'],
      ['youth'],
    ]));
    expect(invalidateQueries).toHaveBeenCalledTimes(3);
  });
});
