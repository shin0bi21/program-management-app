import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getAttendance } from '../../../../../../common/features/Attendance/attendance.api';
import useYouthAttendanceData from './useYouthAttendanceData';

vi.mock('../../../../../../common/features/Attendance/attendance.api', () => ({ getAttendance: vi.fn() }));

it('loads only the selected youth and forwards cancellation to the attendance request', async () => {
  vi.mocked(getAttendance).mockResolvedValue({ groups: [] });
  const { result, rerender } = renderHook(({ youthId, cycleId }: { youthId: string | null; cycleId?: string }) => useYouthAttendanceData(youthId, { cycleId }), {
    initialProps: { youthId: null } as { youthId: string | null; cycleId?: string },
    wrapper: createQueryClientWrapper(createTestQueryClient()),
  });
  expect(getAttendance).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);

  rerender({ youthId: 'youth-1' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getAttendance).toHaveBeenCalledWith({ youthIds: ['youth-1'], cycleId: undefined }, { signal: expect.any(AbortSignal) });

  rerender({ youthId: 'youth-2' });
  await waitFor(() => expect(getAttendance).toHaveBeenCalledWith({ youthIds: ['youth-2'], cycleId: undefined }, { signal: expect.any(AbortSignal) }));
  rerender({ youthId: 'youth-2', cycleId: 'cycle-1' });
  await waitFor(() => expect(getAttendance).toHaveBeenCalledWith({ youthIds: ['youth-2'], cycleId: 'cycle-1' }, { signal: expect.any(AbortSignal) }));
});
