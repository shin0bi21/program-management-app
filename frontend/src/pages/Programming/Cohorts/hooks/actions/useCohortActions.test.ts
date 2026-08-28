// Owns Cohorts mutations and cross-query reconciliation.
import { act, renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper } from '../../../../../tests/queryClientTestUtils';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import useCohortActions from './useCohortActions';

const api = vi.hoisted(() => ({ deleteCohort: vi.fn() }));
vi.mock('../../../../../common/features/programming/api/cohorts.api', () => ({
  deleteCohort: api.deleteCohort,
}));

describe('useCohortActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the requested cohort and reconciles selection', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
});
