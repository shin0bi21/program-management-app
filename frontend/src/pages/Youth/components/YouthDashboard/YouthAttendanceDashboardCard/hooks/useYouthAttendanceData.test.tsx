import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getYouthAttendance } from '../../../../../../common/features/Attendance/attendance.api';
import useYouthAttendanceData from './useYouthAttendanceData';

vi.mock('../../../../../../common/features/Attendance/attendance.api', () => ({ getYouthAttendance: vi.fn() }));

it('loads only the selected youth and forwards cancellation to the attendance request', async () => {
  vi.mocked(getYouthAttendance).mockResolvedValue(null);
  const { result, rerender } = renderHook(({ youthId }: { youthId: string | null }) => useYouthAttendanceData(youthId), {
    initialProps: { youthId: null } as { youthId: string | null },
    wrapper: createQueryClientWrapper(createTestQueryClient()),
  });
  expect(getYouthAttendance).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);

  rerender({ youthId: 'youth-1' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getYouthAttendance).toHaveBeenCalledWith('youth-1', { signal: expect.any(AbortSignal) });

  rerender({ youthId: 'youth-2' });
  await waitFor(() => expect(getYouthAttendance).toHaveBeenCalledWith('youth-2', { signal: expect.any(AbortSignal) }));
});
