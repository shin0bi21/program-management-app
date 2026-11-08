import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import { getYouth } from '../../../youth.api';
import useYouthTableData from './useYouthTableData';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import { youthData } from '../../../hooks/data/useYouthData';
import type { CursorPage } from '../../../../../query/types';
import type { YouthProfile } from '../../../types';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
vi.mock('../../../youth.api', () => ({ getYouth: vi.fn() }));

describe('useYouthTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getYouth).mockResolvedValue({ rows: [makeYouthProfile()], nextCursor: null } as never);
  });

  it('configures the youth table key and forwards filters, sorting, cursors, and cancellation', async () => {
    const filters = { search: 'avery', cycleIds: ['cycle-1'] };
    const sorting = { key: 'lastName' as const, direction: 'desc' as const };
    renderHook(() => useYouthTableData({}, filters, sorting), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.queryKey).toEqual(['youth', 'table', filters, sorting]);
    expect(options.enabled).toBe(true);

    const signal = new AbortController().signal;
    const context = (pageParam: string | null) => ({ signal, pageParam } as Parameters<typeof options.queryFn>[0]);
    await options.queryFn(context(null));
    expect(getYouth).toHaveBeenLastCalledWith(
      undefined, filters, { signal }, { ...sorting, cursor: undefined, limit: 50 },
    );

    await options.queryFn(context('cursor-2'));
    expect(getYouth).toHaveBeenLastCalledWith(
      undefined, filters, { signal }, { ...sorting, cursor: 'cursor-2', limit: 50 },
    );
  });

  it('disables the query until youth filters are initialized', () => {
    renderHook(() => useYouthTableData({}, null), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(['youth', 'table', null, { key: 'firstName', direction: 'asc' }]);
  });

  it('keeps a saved profile when an older list read finishes later', async () => {
    const client = createTestQueryClient();
    const profile = makeYouthProfile();
    let finish!: (page: CursorPage<YouthProfile>) => void;
    vi.mocked(getYouth).mockReturnValue(new Promise<CursorPage<YouthProfile>>(resolve => { finish = resolve; }) as never);
    renderHook(() => useYouthTableData({}, {}), { wrapper: createQueryClientWrapper(client) });
    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    const signal = new AbortController().signal;
    const pending = options.queryFn({ signal, pageParam: null } as Parameters<typeof options.queryFn>[0]);
    const saved = { ...profile, firstName: 'Saved name' };
    youthData.write(client, saved);

    finish({ rows: [profile], nextCursor: null });
    expect(await pending).toEqual({ rows: [{ id: profile.id, sortValue: 'saved name' }], nextCursor: null });
    expect(youthData.get(client, profile.id)).toEqual(saved);
  });
});
