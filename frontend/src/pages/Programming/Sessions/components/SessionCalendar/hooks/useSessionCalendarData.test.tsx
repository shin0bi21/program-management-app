// Scope: verifies calendar-range query activation, filter serialization, event mapping, and errors.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { DatesSetInfo } from '@fullcalendar/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCohortSession } from '../../../../../../tests/factories/session';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../../tests/queryClientTestUtils';
import { useSessionCalendarData } from './useSessionCalendarData';

const getSessions = vi.hoisted(() => vi.fn());

vi.mock('../../../../../../common/features/programming/api/sessions.api', () => ({ getSessions }));

const queryKey = ['sessions', 'calendar'] as const;
const filters = {
  programIds: ['program-1'],
  cohortId: 'cohort-1',
  sessionTypeIds: ['type-1'],
  statuses: ['upcoming' as const],
  search: 'communication',
};
const range = {
  start: new Date('2026-08-01T00:00:00.000Z'),
  end: new Date('2026-09-01T00:00:00.000Z'),
} as DatesSetInfo;

describe('useSessionCalendarData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not query until the calendar supplies a visible range', () => {
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useSessionCalendarData(queryKey, filters, ''),
      { wrapper: createQueryClientWrapper(client) },
    );

    expect(result.current.sessions).toEqual([]);
    expect(result.current.events).toEqual([]);
    expect(getSessions).not.toHaveBeenCalled();
  });

  it('loads the visible range and maps selected cancelled sessions into calendar events', async () => {
    const session = makeCohortSession({
      cancelledAt: '2026-08-10T12:00:00.000Z',
      sessionTypeName: 'Guest Speaker',
    });
    getSessions.mockResolvedValue([session]);
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useSessionCalendarData(queryKey, filters, session.id),
      { wrapper: createQueryClientWrapper(client) },
    );

    act(() => result.current.onDatesSet(range));

    await waitFor(() => expect(result.current.sessions).toEqual([session]));
    expect(getSessions).toHaveBeenCalledWith({
      start: '2026-08-01T00:00:00.000Z',
      end: '2026-09-01T00:00:00.000Z',
      programIds: ['program-1'],
      cohortId: 'cohort-1',
      sessionTypeIds: ['type-1'],
      statuses: ['upcoming'],
      search: 'communication',
    }, { signal: expect.any(AbortSignal) });
    expect(result.current.events).toEqual([expect.objectContaining({
      id: session.id,
      classNames: ['programming-calendar-event--selected'],
      backgroundColor: '#6b7280',
      borderColor: '#6b7280',
      extendedProps: {
        programName: session.programName,
        sessionTypeName: 'Guest Speaker',
      },
    })]);
  });

  it('exposes range-loading failures to the calendar view', async () => {
    getSessions.mockRejectedValue(new Error('Calendar unavailable'));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useSessionCalendarData(queryKey, filters, ''),
      { wrapper: createQueryClientWrapper(client) },
    );

    act(() => result.current.onDatesSet(range));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('Calendar unavailable'));
  });
});
