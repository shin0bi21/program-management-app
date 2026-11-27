import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../Programs/types';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import type { SetSessionInput } from '../../../sessions.api';
import type { Session } from '../../../../../../common/features/programming/sessions/types';
import useSessionModal from './useSessionModal';

const onSave = vi.fn<(input: SetSessionInput) => Promise<Session>>();
const programs: Program[] = [
  { id: 'p1', title: 'Art', enrollmentRequired: false, minAge: null, maxAge: null,
    defaultDayOfWeek: 'tuesday', defaultStartTime: '17:30', defaultEndTime: '19:30', timezone: 'America/Toronto' },
  { id: 'p2', title: 'Music', enrollmentRequired: false, minAge: null, maxAge: null,
    defaultDayOfWeek: 'thursday', defaultStartTime: '16:00', defaultEndTime: '18:00', timezone: 'America/Toronto' },
];
describe('single session creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(makeProgramSession());
  });

  it('does not create a session without a selected program', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSessionModal({ programs: [], onSave, onSaved }));
    act(() => {
      result.current.setValue('title', 'Workshop');
      result.current.setValue('sessionType', 'Regular');
    });

    await act(() => result.current.submit());

    expect(onSave).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('preserves the edited draft when incoming context refreshes', async () => {
    const onSaved = vi.fn();
    const { result, rerender } = renderHook(
      ({ programId, date }) => useSessionModal({ programs, programId, date, onSave, onSaved }),
      { initialProps: { programId: 'p1', date: '2026-11-04' } },
    );
    act(() => {
      result.current.selectProgram('p2');
      result.current.setValue('title', 'Music workshop');
      result.current.setValue('sessionType', 'Regular');
      result.current.setValue('date', '2026-11-12');
      result.current.setValue('startTime', '15:00');
      result.current.setValue('endTime', '17:00');
    });

    rerender({ programId: 'p1', date: '2026-12-01' });
    await act(() => result.current.submit());

    expect(onSave).toHaveBeenCalledWith({
      programId: 'p2', sessionType: 'Regular', title: 'Music workshop',
      date: '2026-11-12', startTime: '15:00', endTime: '17:00', description: null,
    });
  });

  it('uses program times and preserves a supplied calendar date when changing programs', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSessionModal({ programs, programId: 'p1', date: '2026-11-04', onSave, onSaved }));
    expect(result.current.draft).toMatchObject({ date: '2026-11-04', startTime: '17:30', endTime: '19:30' });
    act(() => result.current.selectProgram('p2'));
    expect(result.current.draft).toMatchObject({ date: '2026-11-04', startTime: '16:00', endTime: '18:00' });
    act(() => {
      result.current.setValue('title', ' Music ');
      result.current.setValue('sessionType', 'Regular');
      result.current.setValue('description', ' Practice session ');
    });
    await act(() => result.current.submit());
    expect(onSave).toHaveBeenCalledWith({
      programId: 'p2', description: 'Practice session',
      sessionType: 'Regular', title: 'Music', date: '2026-11-04', startTime: '16:00', endTime: '18:00',
    });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('shows cycle resolution errors from the server without retrying another assignment', async () => {
    onSave.mockRejectedValueOnce(new Error('No assigned cycle covers this session date.'));
    const { result } = renderHook(() => useSessionModal({ programs, programId: 'p1', onSave, onSaved: vi.fn() }));
    act(() => { result.current.setValue('title', 'Art'); result.current.setValue('sessionType', 'Regular'); });
    await act(() => result.current.submit());
    expect(result.current.status).toBe('error');
    expect(result.current.message).toContain('No assigned cycle');
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('locks duplicate submissions, retains success if refresh fails, and permits retry after API failure', async () => {
    onSave.mockRejectedValueOnce(new Error('Try again')).mockResolvedValueOnce(makeProgramSession());
    const onSaved = vi.fn().mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useSessionModal({ programs, programId: 'p1', onSave, onSaved }));
    act(() => { result.current.setValue('title', 'Art'); result.current.setValue('sessionType', 'Regular'); });
    await act(() => result.current.submit());
    expect(result.current.status).toBe('error');
    await act(async () => { await Promise.all([result.current.submit(), result.current.submit()]); });
    expect(onSave).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.message).toContain('could not refresh');
  });
});
