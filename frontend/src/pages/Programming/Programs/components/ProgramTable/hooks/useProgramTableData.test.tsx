import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { getProgramList } from '../../../api/programs.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useProgramTableData from './useProgramTableData';

vi.mock('../../../api/programs.api', () => ({ getProgramList: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('requests the assigned scope, standard page size and cancellation, then forwards the next cursor', async () => {
  vi.mocked(getProgramList)
    .mockResolvedValueOnce({ rows: [], nextCursor: 'next-page' })
    .mockResolvedValueOnce({ rows: [], nextCursor: null });
  const filters = { assignedOnly: true };
  const { result } = renderHook(() => useProgramTableData(['programs', 'table'], filters), {
    wrapper: createQueryClientWrapper(createTestQueryClient()),
  });

  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  expect(getProgramList).toHaveBeenCalledWith(filters,
    { key: 'name', direction: 'asc', limit: 50, cursor: undefined }, { signal: expect.any(AbortSignal) });

  act(() => result.current.loadNextPage());

  await waitFor(() => expect(getProgramList).toHaveBeenLastCalledWith(filters,
    { key: 'name', direction: 'asc', limit: 50, cursor: 'next-page' }, { signal: expect.any(AbortSignal) }));
});

it('keeps different program scopes in separate table queries', async () => {
  vi.mocked(getProgramList).mockResolvedValue({ rows: [], nextCursor: null });
  const { rerender } = renderHook(({ assignedOnly }) => useProgramTableData(['programs', 'table'], { assignedOnly }), {
    initialProps: { assignedOnly: true }, wrapper: createQueryClientWrapper(createTestQueryClient()),
  });
  await waitFor(() => expect(getProgramList).toHaveBeenCalledTimes(1));

  rerender({ assignedOnly: false });

  await waitFor(() => expect(getProgramList).toHaveBeenCalledTimes(2));
  expect(getProgramList).toHaveBeenLastCalledWith({ assignedOnly: false }, expect.any(Object), { signal: expect.any(AbortSignal) });
});
