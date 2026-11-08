import { sessionStore, getSessionSortValue } from '../../../Programming/Sessions/sessionStore';
import { makeProgramSession } from '../../../../tests/factories/session';
import type { InfiniteData } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CursorPage } from '../../../../query/types';

const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;
import type { YouthProfile } from '../../types';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../tests/queryClientTestUtils';
import { useYouthActions } from './useYouthActions';

/**
 * Wraps supplied profile pages in the query cache's infinite-list shape.
 * @param pages - Profiles grouped into the pages loaded by a test.
 * @example infiniteData([profile]) // one terminal page containing that profile
 */
function infiniteData(...pages: YouthProfile[][]): InfiniteData<CursorPage<YouthProfile>> {
  return {
    pages: pages.map(rows => ({ rows, nextCursor: null })),
    pageParams: pages.map(() => null),
  };
}

/**
 * Mounts Youth actions with an isolated cache and selected-profile reconciliation callback.
 * @param onYouthReconciled - Receives authoritative profiles after a successful update.
 * @example renderActions() // hook, cache, and reconciliation spy for one test
 */
function renderActions(onYouthReconciled = vi.fn()) {
  const queryClient = createTestQueryClient();
  const rendered = renderHook(() => useYouthActions({ onYouthReconciled }), {
    wrapper: createQueryClientWrapper(queryClient),
  });
  return { ...rendered, queryClient, onYouthReconciled };
}

describe('useYouthActions', () => {
  it('replaces the authoritative row in every table variant while preserving unrelated references', () => {
    const original = makeYouthProfile();
    const unrelated = makeYouthProfile({ id: 'youth-2', firstName: 'Alex' });
    const saved = makeYouthProfile({ firstName: 'Updated', contacts: [] });
    const firstKey = [...YOUTH_TABLE_QUERY_KEY, { programIds: ['program-1'] }, { key: 'firstName' }];
    const secondKey = [...YOUTH_TABLE_QUERY_KEY, { search: 'Jamie' }, { key: 'lastName' }];
    const absentKey = [...YOUTH_TABLE_QUERY_KEY, { search: 'missing' }, { key: 'firstName' }];
    const first = infiniteData([original, unrelated]);
    const second = infiniteData([original]);
    const absent = infiniteData([unrelated]);
    const rendered = renderActions();
    rendered.queryClient.setQueryData(firstKey, first);
    rendered.queryClient.setQueryData(secondKey, second);
    rendered.queryClient.setQueryData(absentKey, absent);
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries');

    act(() => rendered.result.current.reconcileSavedYouth(saved));

    const firstResult = rendered.queryClient.getQueryData<InfiniteData<CursorPage<YouthProfile>>>(firstKey)!;
    const secondResult = rendered.queryClient.getQueryData<InfiniteData<CursorPage<YouthProfile>>>(secondKey)!;
    expect(firstResult.pages[0].rows).toEqual([saved, unrelated]);
    expect(firstResult.pages[0].rows[1]).toBe(unrelated);
    expect(secondResult.pages[0].rows).toEqual([saved]);
    expect(rendered.queryClient.getQueryData(absentKey)).toBe(absent);
    expect(rendered.onYouthReconciled).toHaveBeenCalledWith(saved);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates youth queries after creation because list membership and order may change', () => {
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries').mockResolvedValue();

    act(() => rendered.result.current.reconcileCreatedYouth(makeYouthProfile({ id: 'youth-new' })));

    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: YOUTH_TABLE_QUERY_KEY });
    expect(rendered.onYouthReconciled).not.toHaveBeenCalled();
  });

  it('reconciles attendance response rows and selection without invalidating table queries', () => {
    const rendered = renderActions();
    const youth = makeYouthProfile();
    const session = makeProgramSession({ theme: 'Updated attendance session' });
    const key = ['sessions', 'table', {}, { key: 'date', direction: 'asc' }];
    rendered.queryClient.setQueryData(key, { pages: [{ rows: [{ id: session.id, sortValue: getSessionSortValue(session, 'date') }], nextCursor: null }], pageParams: [null] });
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries');

    act(() => rendered.result.current.reconcileAttendance({
      programCycle: { programId: 'program-1', cycleId: 'cycle-1', cycle: 'Summer', program: 'Skills', enrollmentRequired: true },
      sessions: [], youth, updatedSessions: [session],
    }));

    expect(rendered.onYouthReconciled).toHaveBeenCalledWith(youth);
    expect(rendered.queryClient.getQueryData(key)).toEqual({ pages: [{ rows: [{ id: session.id, sortValue: getSessionSortValue(session, 'date') }], nextCursor: null }], pageParams: [null] });
    expect(rendered.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', session.id, 'roster'] });
    expect(sessionStore.get(rendered.queryClient, session.id)).toEqual(session);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'cycle-assignments'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'attendance-summary', youth.id] });
  });
});
