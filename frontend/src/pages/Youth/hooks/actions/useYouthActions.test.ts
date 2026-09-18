import type { InfiniteData } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CursorPage } from '../../../../query/types';

const COHORT_QUERY_KEY = ['cohorts'] as const;
const SESSION_QUERY_KEY = ['sessions'] as const;
const YOUTH_QUERY_KEY = ['youth'] as const;
const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;
import type { YouthProfile } from '../../types';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../tests/queryClientTestUtils';
import { useYouthActions } from './useYouthActions';

function infiniteData(...pages: YouthProfile[][]): InfiniteData<CursorPage<YouthProfile>> {
  return {
    pages: pages.map(rows => ({ rows, nextCursor: null })),
    pageParams: pages.map(() => null),
  };
}

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
    expect(invalidate).toHaveBeenCalledWith({ queryKey: YOUTH_QUERY_KEY });
    expect(rendered.onYouthReconciled).not.toHaveBeenCalled();
  });

  it('refreshes youth, session, and cohort records after attendance changes', async () => {
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries').mockResolvedValue();

    await act(() => rendered.result.current.refreshAttendance());

    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: YOUTH_QUERY_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: SESSION_QUERY_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: COHORT_QUERY_KEY });
  });
});
