import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { getProgramCycles } from '../../../../../common/features/programming/cycles/cycles.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { useCycles } from './useCycles';

vi.mock('../../../../../common/features/programming/cycles/cycles.api', () => ({ getProgramCycles: vi.fn() }));

it('loads cycle options with cancellation support', async () => {
  const cycles = [{
    id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' as const,
  }];
  vi.mocked(getProgramCycles).mockResolvedValue(cycles);
  const { result } = renderHook(() => useCycles(), {
    wrapper: createQueryClientWrapper(createTestQueryClient()),
  });

  await waitFor(() => expect(result.current.cycles).toEqual(cycles));
  expect(result.current).toMatchObject({ loading: false, error: '' });
  expect(getProgramCycles).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
});
