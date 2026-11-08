import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getYouthAttendanceSummary } from '../youthAttendanceSummary.api';
import useYouthAttendanceSummary from './useYouthAttendanceSummary';

vi.mock('../youthAttendanceSummary.api', () => ({ getYouthAttendanceSummary: vi.fn() }));

it('loads only the selected youth and forwards cancellation to the summary request', async () => {
  vi.mocked(getYouthAttendanceSummary).mockResolvedValue([]);
  const { result, rerender } = renderHook(({ youthId }: { youthId: string | null }) => useYouthAttendanceSummary(youthId), {
    initialProps: { youthId: null } as { youthId: string | null },
    wrapper: createQueryClientWrapper(createTestQueryClient()),
  });
  expect(getYouthAttendanceSummary).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);

  rerender({ youthId: 'youth-1' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getYouthAttendanceSummary).toHaveBeenCalledWith('youth-1', { signal: expect.any(AbortSignal) });

  rerender({ youthId: 'youth-2' });
  await waitFor(() => expect(getYouthAttendanceSummary).toHaveBeenCalledWith('youth-2', { signal: expect.any(AbortSignal) }));
});
