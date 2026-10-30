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
      () => useCohortActions({ tableQueryKey: ['cohorts', 'table'], onCohortRemoved, onCohortSynced: vi.fn() }),
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

  it('replaces authoritative edited rows without invalidating the table', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const onCohortSynced = vi.fn();
    const { result } = renderHook(
      () => useCohortActions({ tableQueryKey: ['cohorts', 'table'], onCohortRemoved: vi.fn(), onCohortSynced }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );
    const cohort = { id: 'cohort-1', enrolledCount: 6 } as ProgramCohort;
    const old = { ...cohort, enrolledCount: 5 };
    queryClient.setQueryData(['cohorts', 'table', 'filtered'], { pages: [{ rows: [old], nextCursor: null }], pageParams: [null] });

    act(() => result.current.syncCohort({ cohort, updatedYouth: [] }));

    expect(onCohortSynced).toHaveBeenCalledWith(cohort);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cohorts', 'options'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['cohorts', 'table'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['youth'] });
    expect(queryClient.getQueryData(['cohorts', 'table', 'filtered'])).toEqual({ pages: [{ rows: [cohort], nextCursor: null }], pageParams: [null] });
  });
});
