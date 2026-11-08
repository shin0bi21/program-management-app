import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../../../common/features/programs/types';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import { createSession } from '../../../sessions.api';
import useAddSessionModal from './useAddSessionModal';

vi.mock('../../../sessions.api', () => ({ createSession: vi.fn() }));
const programs: Program[] = [
  { id: 'p1', name: 'Art', enrollmentRequired: false, minAge: null, maxAge: null,
    defaultDayOfWeek: 'tuesday', defaultStartTime: '17:30', defaultEndTime: '19:30', timezone: 'America/Toronto' },
  { id: 'p2', name: 'Music', enrollmentRequired: false, minAge: null, maxAge: null,
    defaultDayOfWeek: 'thursday', defaultStartTime: '16:00', defaultEndTime: '18:00', timezone: 'America/Toronto' },
];
describe('single session creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSession).mockResolvedValue(makeProgramSession());
  });

  it('uses program times and preserves a supplied calendar date when changing programs', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useAddSessionModal({ programs, initialDate: '2026-11-04', onSaved }));
    expect(result.current.draft).toMatchObject({ date: '2026-11-04', startTime: '17:30', endTime: '19:30' });
    act(() => result.current.selectProgram('p2'));
    expect(result.current.draft).toMatchObject({ date: '2026-11-04', startTime: '16:00', endTime: '18:00' });
    act(() => result.current.updateDraft('theme', ' Music '));
    await act(() => result.current.submit());
    expect(createSession).toHaveBeenCalledWith({
      programId: 'p2',
      sessionType: 'Regular', theme: 'Music', date: '2026-11-04', startTime: '16:00', endTime: '18:00',
    });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('starts calendar creation with its selected program and allows time edits', () => {
    const { result } = renderHook(() => useAddSessionModal({ programs, initialProgramId: 'p2', initialDate: '2026-11-04', onSaved: vi.fn() }));
    expect(result.current.programId).toBe('p2');
    act(() => result.current.updateDraft('startTime', '15:00'));
    expect(result.current.draft.startTime).toBe('15:00');
  });

  it('shows cycle resolution errors from the server without retrying another assignment', async () => {
    vi.mocked(createSession).mockRejectedValueOnce(new Error('No assigned cycle covers this session date.'));
    const { result } = renderHook(() => useAddSessionModal({ programs, onSaved: vi.fn() }));
    act(() => result.current.updateDraft('theme', 'Art'));
    await act(() => result.current.submit());
    expect(result.current.status).toBe('error');
    expect(result.current.message).toContain('No assigned cycle');
    expect(createSession).toHaveBeenCalledOnce();
  });

  it('locks duplicate submissions, retains success if refresh fails, and permits retry after API failure', async () => {
    vi.mocked(createSession).mockRejectedValueOnce(new Error('Try again')).mockResolvedValueOnce(makeProgramSession());
    const onSaved = vi.fn().mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useAddSessionModal({ programs, onSaved }));
    act(() => result.current.updateDraft('theme', 'Art'));
    await act(() => result.current.submit());
    expect(result.current.status).toBe('error');
    await act(async () => { await Promise.all([result.current.submit(), result.current.submit()]); });
    expect(createSession).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.message).toContain('could not refresh');
  });
});
