import { youthData, getYouthSortValue } from '../data/useYouthData';
import type { RecordListIndex } from '../../../../query/createRecordStore';
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
function infiniteData(...pages: YouthProfile[][]): InfiniteData<CursorPage<RecordListIndex>> {
  return {
    pages: pages.map(rows => ({ rows: rows.map(profile => ({ id: profile.id, sortValue: getYouthSortValue(profile, 'firstName') })), nextCursor: null })),
    pageParams: pages.map(() => null),
  };
}

/**
 * Mounts Youth actions with an isolated record and list cache.
 * @example renderActions() // hook and cache for one test
 */
function renderActions() {
  const queryClient = createTestQueryClient();
  const rendered = renderHook(() => useYouthActions(), {
    wrapper: createQueryClientWrapper(queryClient),
  });
  return { ...rendered, queryClient };
}

describe('useYouthActions', () => {
  it('replaces the authoritative index in every table variant while preserving unrelated references', () => {
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

    const firstResult = rendered.queryClient.getQueryData<InfiniteData<CursorPage<RecordListIndex>>>(firstKey)!;
    const secondResult = rendered.queryClient.getQueryData<InfiniteData<CursorPage<RecordListIndex>>>(secondKey)!;
    expect(firstResult.pages[0].rows).toEqual([{ id: saved.id, sortValue: 'updated' }, { id: unrelated.id, sortValue: 'alex' }]);
    expect(youthData.get(rendered.queryClient, saved.id)).toEqual(saved);
    expect(firstResult.pages[0].rows[1]).toBe(first.pages[0].rows[1]);
    expect(secondResult.pages[0].rows).toEqual([{ id: saved.id, sortValue: getYouthSortValue(saved, 'lastName') }]);
    expect(rendered.queryClient.getQueryData(absentKey)).toBe(absent);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates youth queries after creation because list membership and order may change', () => {
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries').mockResolvedValue();

    act(() => rendered.result.current.reconcileCreatedYouth(makeYouthProfile({ id: 'youth-new' })));

    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: YOUTH_TABLE_QUERY_KEY });
    expect(youthData.get(rendered.queryClient, 'youth-new')).toEqual(makeYouthProfile({ id: 'youth-new' }));
  });

  it('reconciles attendance response records without invalidating table queries', () => {
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

    expect(youthData.get(rendered.queryClient, youth.id)).toEqual(youth);
    expect(rendered.queryClient.getQueryData(key)).toEqual({ pages: [{ rows: [{ id: session.id, sortValue: getSessionSortValue(session, 'date') }], nextCursor: null }], pageParams: [null] });
    expect(rendered.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', session.id, 'roster'] });
    expect(sessionStore.get(rendered.queryClient, session.id)).toEqual(session);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'cycle-assignments'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'attendance-summary', youth.id] });
  });

  it('ignores modal save callbacks captured before account cache clearing', () => {
    const rendered = renderActions();
    const oldActions = rendered.result.current;
    rendered.queryClient.clear();
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries');

    act(() => {
      oldActions.reconcileSavedYouth(makeYouthProfile());
      oldActions.reconcileCreatedYouth(makeYouthProfile({ id: 'new-youth' }));
      oldActions.reconcileAttendance({
        programCycle: { programId: 'program-1', cycleId: 'cycle-1', cycle: 'Summer', program: 'Skills', enrollmentRequired: true },
        sessions: [], youth: makeYouthProfile(),
      });
    });

    expect(youthData.get(rendered.queryClient, 'youth-1')).toBeUndefined();
    expect(youthData.get(rendered.queryClient, 'new-youth')).toBeUndefined();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
