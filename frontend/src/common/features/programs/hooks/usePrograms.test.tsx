import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { getPrograms } from '../programs.api';
import type { Program } from '../types';
import { usePrograms } from './usePrograms';

vi.mock('../programs.api', () => ({ getPrograms: vi.fn() }));

const getProgramsMock = vi.mocked(getPrograms);
const programs: Program[] = [{
  id: 'program-1',
  name: 'Soft Skills',
  description: null,
  rosterMode: 'enrolled',
  minAge: null,
  maxAge: null,
  defaultDayOfWeek: 'tuesday',
  defaultStartTime: '17:00',
  defaultEndTime: '19:30',
  timezone: 'America/Toronto',
}];

describe('usePrograms', () => {
  beforeEach(() => getProgramsMock.mockReset());

  it('loads the requested program scope with request cancellation support', async () => {
    getProgramsMock.mockResolvedValue(programs);
    const queryClient = createTestQueryClient();
    const { result } = renderHook(
      () => usePrograms({ assignedOnly: true }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getProgramsMock).toHaveBeenCalledWith(
      { assignedOnly: true },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.programs).toEqual(programs);
  });

  it('updates the shared list cache when a program is created', async () => {
    getProgramsMock.mockResolvedValue(programs);
    const queryClient = createTestQueryClient();
    const { result } = renderHook(usePrograms, {
      wrapper: createQueryClientWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const created: Program = { ...programs[0], id: 'program-2', name: 'Leadership' };

    act(() => result.current.upsertProgram(created));

    await waitFor(() => expect(result.current.programs).toEqual([...programs, created]));
  });
});
