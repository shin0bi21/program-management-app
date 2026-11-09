import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { makeProgramSession } from '../../../../../tests/factories/session';
import type { UpdatedSessionResult } from '../../sessions.api';
import useSessionActions from './useSessionActions';

const api = vi.hoisted(() => ({ deleteSession: vi.fn(), moveSessionDate: vi.fn() }));
vi.mock('../../sessions.api', () => ({ deleteSession: api.deleteSession, moveSessionDate: api.moveSessionDate }));

/**
 * Mounts session actions with an isolated query cache and calendar callbacks.
 * @example renderActions() // actions and their selected-context callbacks
 */
function renderActions() {
  const client = createTestQueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const onSessionSynced = vi.fn();
  const onSessionRemoved = vi.fn();
  const hook = renderHook(() => useSessionActions({ onSessionRemoved, onSessionSynced }), {
    wrapper: createQueryClientWrapper(client),
  });
  const calendar = { upsert: vi.fn(), remove: vi.fn() };
  hook.result.current.calendarCacheRef.current = calendar;
  return { ...hook, client, invalidate, onSessionSynced, onSessionRemoved, calendar };
}

describe('useSessionActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the complete move response and locks duplicate drops', async () => {
    const session = makeProgramSession();
    const saved = makeProgramSession({
      ...session, theme: 'Changed after the client read', cycle: 'Winter', cycleId: 'cycle-2',
      startsAt: '2027-01-12T18:00:00Z', endsAt: '2027-01-12T20:00:00Z',
    });
    const { result, invalidate, calendar, onSessionSynced } = renderActions();
    let finish!: (value: UpdatedSessionResult) => void;
    api.moveSessionDate.mockReturnValue(new Promise<UpdatedSessionResult>(resolve => { finish = resolve; }));

    let first!: ReturnType<typeof result.current.moveSession>;
    await act(async () => {
      first = result.current.moveSession(session, '2027-01-12');
      await result.current.moveSession(session, '2027-01-13');
    });
    expect(api.moveSessionDate).toHaveBeenCalledOnce();
    expect(result.current.pendingSessionIds).toEqual([session.id]);

    await act(async () => { finish({ session: saved }); await first; });

    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(calendar.upsert).toHaveBeenCalledWith(saved);
    expect(onSessionSynced).toHaveBeenCalledWith(saved);
    expect(result.current.pendingSessionIds).toEqual([]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'cycle-assignments'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', saved.id, 'roster'] });
    expect(result.current.calendarRevision).toBe(0);
  });

  it('keeps failed moves unchanged and permits a retry', async () => {
    const { result, calendar, onSessionSynced, invalidate } = renderActions();
    api.moveSessionDate.mockRejectedValueOnce(new Error('Session has already started'));

    await act(async () => { expect(await result.current.moveSession(makeProgramSession(), '2027-01-12')).toBeNull(); });

    expect(result.current.moveError).toBe('Session has already started');
    expect(result.current.pendingSessionIds).toEqual([]);
    expect(calendar.upsert).not.toHaveBeenCalled();
    expect(onSessionSynced).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('removes deleted rows without rebuilding the calendar buffer', async () => {
    const session = makeProgramSession();
    const { result, invalidate, calendar, onSessionRemoved } = renderActions();
    api.deleteSession.mockResolvedValue({ id: session.id });

    act(() => result.current.requestDelete(session));
    await act(() => result.current.confirmAction!.onConfirm());

    expect(calendar.remove).toHaveBeenCalledWith(session.id);
    expect(onSessionRemoved).toHaveBeenCalledWith(session.id);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'cycle-assignments'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'attendance'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(result.current.calendarRevision).toBe(0);
  });

  it('updates the attendance roster and refreshes related summaries', () => {
    const { result, client, invalidate } = renderActions();
    const session = makeProgramSession({ theme: 'Saved attendance session' });
    const roster = [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Lee', status: 'present' as const, notes: null }];
    act(() => result.current.syncAttendance({ session, roster }));

    expect(client.getQueryData(['sessions', session.id, 'roster'])).toBe(roster);
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['youth', 'table'] });
    expect(result.current.calendarRevision).toBe(0);
  });

  it('invalidates the exact session collections and replaces the calendar only after creation', async () => {
    const { result, invalidate } = renderActions();

    await act(() => result.current.refreshCreatedSessions(makeProgramSession()));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(result.current.calendarRevision).toBe(1);
  });

  it('preserves selection and calendar state when deletion fails', async () => {
    const { result, onSessionRemoved, calendar, invalidate } = renderActions();
    api.deleteSession.mockRejectedValueOnce(new Error('Delete failed'));

    act(() => result.current.requestDelete(makeProgramSession()));
    await act(async () => { await expect(result.current.confirmAction!.onConfirm()).rejects.toThrow('Delete failed'); });

    expect(onSessionRemoved).not.toHaveBeenCalled();
    expect(calendar.remove).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
