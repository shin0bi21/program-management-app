import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { useAuth } from '../../../../auth/authContext';
import { getProgramCycles } from './cycles.api';
import useDateRangePresets from './useDateRangePresets';

vi.mock('../../../../auth/authContext', () => ({ useAuth: vi.fn(() => ({ permissions: ['read:programs'] })) }));
vi.mock('./cycles.api', () => ({ getProgramCycles: vi.fn() }));
afterEach(() => vi.useRealTimers());

it('uses Toronto today and shared cycle data to offer current date presets', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T02:00:00Z'));
  vi.mocked(getProgramCycles).mockResolvedValue([{
    id: 'summer', name: 'Summer', startsOn: '2026-08-01', endsOn: '2026-08-31', state: 'active',
  }]);
  const client = createTestQueryClient();
  const { result } = renderHook(() => useDateRangePresets(), { wrapper: createQueryClientWrapper(client) });

  await waitFor(() => expect(result.current.some(preset => preset.id === 'current-cycle')).toBe(true));
  expect(result.current[0].range).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  expect(result.current.find(preset => preset.id === 'current-pay-period')?.range)
    .toEqual({ start: '2026-08-29', end: '2026-09-11' });
  expect(client.getQueryData(['program-cycles'])).toEqual(expect.any(Array));
  expect(getProgramCycles).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
});

it('keeps calendar presets available without inventing cycle dates when loading fails', async () => {
  vi.mocked(getProgramCycles).mockRejectedValue(new Error('Unavailable'));
  const client = createTestQueryClient();
  const { result } = renderHook(() => useDateRangePresets(), { wrapper: createQueryClientWrapper(client) });

  await waitFor(() => expect(client.getQueryState(['program-cycles'])?.status).toBe('error'));
  expect(result.current.map(preset => preset.id)).toEqual(['this-month', 'this-year']);
});

it('does not fetch or expose cached cycle presets without programs permission', () => {
  vi.mocked(useAuth).mockReturnValue({ permissions: [] } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(getProgramCycles).mockClear();
  const client = createTestQueryClient();
  client.setQueryData(['program-cycles'], [{
    id: 'hidden', name: 'Hidden', startsOn: '2026-01-01', endsOn: '2026-12-31', state: 'active',
  }]);
  const { result } = renderHook(() => useDateRangePresets(), { wrapper: createQueryClientWrapper(client) });

  expect(getProgramCycles).not.toHaveBeenCalled();
  expect(result.current.map(preset => preset.id)).toEqual(['this-month', 'this-year']);
});
