import { createTestQueryClient, createQueryClientWrapper } from '../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useListQuery from './useListQuery';

interface Row { id: string; name: string }

describe('useListQuery', () => {
  it('updates an existing record and appends a new one in the query cache', async () => {
    const client = createTestQueryClient();
    const wrapper = createQueryClientWrapper(client);
    const { result } = renderHook(() => useListQuery<Row>({
      queryKey: ['rows'],
      queryFn: async () => [{ id: '1', name: 'First' }],
      errorMessage: 'Could not load rows',
    }), { wrapper });

    await waitFor(() => expect(result.current.rows).toEqual([{ id: '1', name: 'First' }]));

    act(() => result.current.upsert({ id: '1', name: 'Updated' }));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: '1', name: 'Updated' }]));

    act(() => result.current.upsert({ id: '2', name: 'Second' }));
    await waitFor(() => expect(result.current.rows).toEqual([
      { id: '1', name: 'Updated' },
      { id: '2', name: 'Second' },
    ]));
  });

  it('removes only the requested row from the query cache', async () => {
    const client = createTestQueryClient();
    const wrapper = createQueryClientWrapper(client);
    const { result } = renderHook(() => useListQuery<Row>({
      queryKey: ['rows'],
      queryFn: async () => [
        { id: '1', name: 'First' },
        { id: '2', name: 'Second' },
      ],
      errorMessage: 'Could not load rows',
    }), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.remove('1'));

    await waitFor(() => expect(result.current.rows).toEqual([{ id: '2', name: 'Second' }]));
  });
});
