import { act, renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper } from '../../../../../tests/queryClientTestUtils';
import { makeCohortSession } from '../../../../../tests/factories/session';
import useSessionActions from './useSessionActions';

const api = vi.hoisted(() => ({ deleteSession: vi.fn() }));
vi.mock('../../sessions.api', () => ({
  deleteSession: api.deleteSession,
}));

describe('useSessionActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the requested session and reconciles calendar and cohort owners', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const onSessionRemoved = vi.fn();
    api.deleteSession.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useSessionActions({ onSessionRemoved }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );
    const session = makeCohortSession();

    act(() => result.current.requestDelete(session));
    await act(() => result.current.confirmAction!.onConfirm());

    expect(api.deleteSession).toHaveBeenCalledWith(session.id);
    expect(onSessionRemoved).toHaveBeenCalledWith(session.id);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions', 'calendar'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cohorts'] });
  });

  it('refreshes session and youth owners after attendance changes', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const { result } = renderHook(
      () => useSessionActions({ onSessionRemoved: vi.fn() }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await act(() => result.current.refreshAttendance());

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions', 'calendar'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['youth'] });
  });
});
