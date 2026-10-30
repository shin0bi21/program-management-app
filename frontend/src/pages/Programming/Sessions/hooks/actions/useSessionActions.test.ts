import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import type { ProgramCohort } from '../../../Cohorts/types';
import { makeCohortSession } from '../../../../../tests/factories/session';
import type { UpdatedSessionResult } from '../../sessions.api';
import type { CohortSession } from '../../types';
import useSessionActions from './useSessionActions';

const api = vi.hoisted(() => ({ deleteSession: vi.fn(), moveSessionDate: vi.fn() }));
vi.mock('../../sessions.api', () => ({ deleteSession: api.deleteSession, moveSessionDate: api.moveSessionDate }));

const tableKey = ['sessions', 'table', {}];

function renderActions(session = makeCohortSession()) {
  const client = createTestQueryClient();
  const other = makeCohortSession({ id: 'other-session' });
  client.setQueryData(tableKey, { pages: [{ rows: [session, other], nextCursor: 'next' }], pageParams: [null] });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const onSessionSynced = vi.fn();
  const onSessionRemoved = vi.fn();
  const hook = renderHook(() => useSessionActions({ onSessionRemoved, onSessionSynced }), {
    wrapper: createQueryClientWrapper(client),
  });
  const calendar = { upsert: vi.fn(), remove: vi.fn() };
  hook.result.current.calendarCacheRef.current = calendar;
  return { ...hook, client, invalidate, onSessionSynced, onSessionRemoved, calendar, other };
}

describe('useSessionActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the complete move response, locks duplicate drops, and preserves unrelated rows and cursor state', async () => {
    const session = makeCohortSession();
    const saved = makeCohortSession({
      ...session, theme: 'Changed after the client read', cohortId: 'cohort-2', cohortName: 'Winter', cycleId: 'cycle-2',
      startsAt: '2027-01-12T18:00:00Z', endsAt: '2027-01-12T20:00:00Z', attendedCount: 4,
    });
    const { result, client, invalidate, calendar, other, onSessionSynced } = renderActions(session);
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

    const page = client.getQueryData<{ pages: { rows: CohortSession[]; nextCursor: string }[] }>(tableKey)!.pages[0];
    expect(page.rows[0]).toEqual(saved);
    expect(page.rows[1]).toBe(other);
    expect(page.nextCursor).toBe('next');
    expect(calendar.upsert).toHaveBeenCalledWith(saved);
    expect(onSessionSynced).toHaveBeenCalledWith(saved);
    expect(result.current.pendingSessionIds).toEqual([]);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ['cohorts', 'options'] });
    expect(result.current.calendarRevision).toBe(0);
  });

  it('keeps failed moves unchanged and permits a retry', async () => {
    const { result, calendar, onSessionSynced, invalidate } = renderActions();
    api.moveSessionDate.mockRejectedValueOnce(new Error('Session has already started'));

    await act(async () => { expect(await result.current.moveSession(makeCohortSession(), '2027-01-12')).toBeNull(); });

    expect(result.current.moveError).toBe('Session has already started');
    expect(result.current.pendingSessionIds).toEqual([]);
    expect(calendar.upsert).not.toHaveBeenCalled();
    expect(onSessionSynced).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('deletes without refetching or rebuilding the calendar buffer', async () => {
    const session = makeCohortSession();
    const { result, client, invalidate, calendar, onSessionRemoved, other } = renderActions(session);
    api.deleteSession.mockResolvedValue({ id: session.id });

    act(() => result.current.requestDelete(session));
    await act(() => result.current.confirmAction!.onConfirm());

    expect(client.getQueryData(tableKey)).toMatchObject({ pages: [{ rows: [other], nextCursor: 'next' }] });
    expect(calendar.remove).toHaveBeenCalledWith(session.id);
    expect(onSessionRemoved).toHaveBeenCalledWith(session.id);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ['cohorts', 'options'] });
    expect(result.current.calendarRevision).toBe(0);
  });

  it('reconciles the canonical attendance response without invalidating table collections', () => {
    const { result, client, invalidate } = renderActions();
    const session = makeCohortSession({ attendedCount: 2, attendanceMarkedCount: 3, attendanceRate: 66.7 });
    const youth = makeYouthProfile({ lastAttendedOn: '2026-08-10' });
    const cohort: ProgramCohort = {
      id: 'cohort-1', programId: 'program-1', programName: 'Future Ready', enrollmentRequired: true,
      minAge: null, maxAge: null, cycleId: 'cycle-1', name: 'Fall', cycleName: 'Fall',
      startsOn: '2026-08-01', endsOn: '2026-12-31', enrolledCount: 3, nextSessionAt: null,
      nextSessionId: null, averageAttendance: 66.7, attendanceAttendedCount: 2,
      attendanceRecordedCount: 3, uniqueAttendeeCount: 2, state: 'active',
    };
    client.setQueryData(['youth', 'table', {}], { pages: [{ rows: [makeYouthProfile()], nextCursor: null }], pageParams: [null] });
    client.setQueryData(['cohorts', 'table', {}], { pages: [{ rows: [{ ...cohort, averageAttendance: null }], nextCursor: null }], pageParams: [null] });
    const roster = [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Lee', status: 'present' as const, notes: null }];

    act(() => result.current.syncAttendance({ session, roster, updatedYouth: [youth], updatedCohort: cohort }));

    expect(client.getQueryData(tableKey)).toMatchObject({ pages: [{ rows: [session, expect.anything()] }] });
    expect(client.getQueryData(['sessions', session.id, 'roster'])).toBe(roster);
    expect(client.getQueryData(['youth', 'table', {}])).toMatchObject({ pages: [{ rows: [youth] }] });
    expect(client.getQueryData(['cohorts', 'table', {}])).toMatchObject({ pages: [{ rows: [cohort] }] });
    expect(invalidate.mock.calls.map(([options]) => options?.queryKey)).toEqual([
      ['cohorts', 'options'], ['youth-cohort-attendance'],
    ]);
    expect(result.current.calendarRevision).toBe(0);
  });

  it('invalidates the exact session collections and replaces the calendar only after creation', async () => {
    const { result, invalidate } = renderActions();

    await act(() => result.current.refreshCreatedSessions(makeCohortSession()));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(result.current.calendarRevision).toBe(1);
  });

  it('preserves selection and calendar state when deletion fails', async () => {
    const { result, onSessionRemoved, calendar, invalidate } = renderActions();
    api.deleteSession.mockRejectedValueOnce(new Error('Delete failed'));

    act(() => result.current.requestDelete(makeCohortSession()));
    await expect(result.current.confirmAction!.onConfirm()).rejects.toThrow('Delete failed');

    expect(onSessionRemoved).not.toHaveBeenCalled();
    expect(calendar.remove).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
