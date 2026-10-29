import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { makeCohortSession } from '../../../../../tests/factories/session';
import type { CohortSession } from '../../types';
import useSessionActions from './useSessionActions';

const api = vi.hoisted(() => ({ deleteSession: vi.fn(), moveSessionDate: vi.fn() }));
vi.mock('../../sessions.api', () => ({
  deleteSession: api.deleteSession,
  moveSessionDate: api.moveSessionDate,
}));

describe('useSessionActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('moves one session, locks duplicate drops, and reconciles the cached table row', async () => {
    const queryClient = createTestQueryClient();
    const session = makeCohortSession();
    const tableKey = ['sessions', 'table', {}];
    queryClient.setQueryData(tableKey, { pages: [{ rows: [session], nextCursor: null }], pageParams: [null] });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    let finish!: (value: unknown) => void;
    api.moveSessionDate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useSessionActions({ onSessionRemoved: vi.fn() }), {
      wrapper: createQueryClientWrapper(queryClient),
    });
    let first!: ReturnType<typeof result.current.moveSession>;
    await act(async () => {
      first = result.current.moveSession(session, '2027-01-12');
      await result.current.moveSession(session, '2027-01-13');
    });
    expect(api.moveSessionDate).toHaveBeenCalledOnce();
    expect(result.current.pendingSessionIds).toEqual([session.id]);
    const move = { id: session.id, cohortId: 'cohort-2', cohortName: 'Winter', cycleId: 'cycle-2',
      startsAt: '2027-01-12T18:00:00Z', endsAt: '2027-01-12T20:00:00Z' };
    await act(async () => { finish(move); await first; });
    expect(queryClient.getQueryData(tableKey)).toMatchObject({ pages: [{ rows: [{ ...session, ...move }] }] });
    expect(result.current.pendingSessionIds).toEqual([]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cohorts'] });
    expect(result.current.calendarRevision).toBe(0);
  });

  it('keeps failed moves unchanged and permits a retry', async () => {
    const queryClient = createTestQueryClient();
    api.moveSessionDate.mockRejectedValueOnce(new Error('Session has already started'));
    const { result } = renderHook(() => useSessionActions({ onSessionRemoved: vi.fn() }), {
      wrapper: createQueryClientWrapper(queryClient),
    });
    await act(async () => { expect(await result.current.moveSession(makeCohortSession(), '2027-01-12')).toBeNull(); });
    expect(result.current.moveError).toBe('Session has already started');
    expect(result.current.pendingSessionIds).toEqual([]);
  });

  it('deletes the requested session and reconciles calendar and cohort owners', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
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
    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['sessions', 'calendar'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions', 'calendar'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cohorts'] });
    expect(result.current.calendarRevision).toBe(1);
  });

  it('refreshes session and youth owners after attendance changes', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const { result } = renderHook(
      () => useSessionActions({ onSessionRemoved: vi.fn() }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await act(() => result.current.refreshAttendance());

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions', 'calendar'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['youth'] });
    expect(result.current.calendarRevision).toBe(1);
  });

  it('replaces the calendar buffer after session invalidation completes', async () => {
    const queryClient = createTestQueryClient();
    let finishCalendarInvalidation!: () => void;
    const pendingInvalidation = new Promise<void>(resolve => { finishCalendarInvalidation = resolve; });
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(({ queryKey } = {}) => (
      queryKey?.[1] === 'calendar' ? pendingInvalidation : Promise.resolve()
    ));
    const { result } = renderHook(
      () => useSessionActions({ onSessionRemoved: vi.fn() }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refreshSessionQueries(); });
    expect(result.current.calendarRevision).toBe(0);

    await act(async () => {
      finishCalendarInvalidation();
      await refresh;
    });
    expect(result.current.calendarRevision).toBe(1);
  });

  it('cancels an inactive pre-mutation range query before replacing its buffer', async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ['sessions', 'calendar', { start: '2026-08-10', end: '2026-08-11' }];
    let requestSignal: AbortSignal | undefined;
    const oldRequest = queryClient.fetchQuery({
      queryKey,
      queryFn: ({ signal }) => {
        requestSignal = signal;
        return new Promise<CohortSession[]>(() => undefined);
      },
    }).catch(() => undefined);
    const { result } = renderHook(
      () => useSessionActions({ onSessionRemoved: vi.fn() }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await act(() => result.current.refreshSessionQueries());
    await oldRequest;

    expect(requestSignal?.aborted).toBe(true);
    expect(result.current.calendarRevision).toBe(1);
    const updated = makeCohortSession({ theme: 'Updated theme' });
    await expect(queryClient.fetchQuery({ queryKey, queryFn: async () => [updated] })).resolves.toEqual([updated]);
  });

  it('preserves selection and the calendar buffer when deletion fails', async () => {
    const queryClient = createTestQueryClient();
    const onSessionRemoved = vi.fn();
    api.deleteSession.mockRejectedValueOnce(new Error('Delete failed'));
    const { result } = renderHook(
      () => useSessionActions({ onSessionRemoved }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    act(() => result.current.requestDelete(makeCohortSession()));
    await expect(result.current.confirmAction!.onConfirm()).rejects.toThrow('Delete failed');

    expect(onSessionRemoved).not.toHaveBeenCalled();
    expect(result.current.calendarRevision).toBe(0);
  });
});
