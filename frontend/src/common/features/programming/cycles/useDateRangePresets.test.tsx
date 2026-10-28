import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { getCycleReferences } from '../../referenceData/referenceData.api';
import { referenceDataKeys } from '../../referenceData/hooks/useReferenceData';
import useDateRangePresets from './useDateRangePresets';

vi.mock('../../referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn() }));
afterEach(() => vi.useRealTimers());

it('uses Toronto today and shared cycle data to offer current date presets', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T02:00:00Z'));
  vi.mocked(getCycleReferences).mockResolvedValue([{
    id: 'summer', name: 'Summer', startsOn: '2026-08-01', endsOn: '2026-08-31', state: 'active',
  }]);
  const client = createTestQueryClient();
  const { result } = renderHook(() => useDateRangePresets(), { wrapper: createQueryClientWrapper(client) });

  await waitFor(() => expect(result.current.some(preset => preset.id === 'current-cycle')).toBe(true));
  expect(result.current[0].range).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  expect(result.current.find(preset => preset.id === 'current-pay-period')?.range)
    .toEqual({ start: '2026-08-29', end: '2026-09-11' });
  expect(client.getQueryData(referenceDataKeys.cycles)).toEqual(expect.any(Array));
  expect(getCycleReferences).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
});

it('keeps calendar presets available without inventing cycle dates when loading fails', async () => {
  vi.mocked(getCycleReferences).mockRejectedValue(new Error('Unavailable'));
  const client = createTestQueryClient();
  const { result } = renderHook(() => useDateRangePresets(), { wrapper: createQueryClientWrapper(client) });

  await waitFor(() => expect(client.getQueryState(referenceDataKeys.cycles)?.status).toBe('error'));
  expect(result.current.map(preset => preset.id)).toEqual(['this-month', 'this-year']);
});
