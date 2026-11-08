import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateSession } from '../../../sessions.api';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import { useEditSessionModal } from './useEditSessionModal';

vi.mock('../../../sessions.api', () => ({ updateSession: vi.fn() }));

function makeSubmitEvent() {
  const form = document.createElement('form');
  for (const [name, value] of [
    ['theme', ' Career Stories '],
    ['date', '2026-08-10'],
    ['startTime', '13:00'],
    ['endTime', '15:00'],
    ['description', ''],
  ]) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.append(input);
  }
  return { preventDefault: vi.fn(), currentTarget: form } as never;
}

describe('useEditSessionModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes the update command and awaits owner reconciliation', async () => {
    const session = makeProgramSession();
    vi.mocked(updateSession).mockResolvedValue({ session });
    let resolveRefresh!: () => void;
    const onUpdated = vi.fn(() => new Promise<void>(resolve => { resolveRefresh = resolve; }));
    const { result } = renderHook(() => useEditSessionModal(session, onUpdated));
    act(() => result.current.setSessionType('Guest Speaker'));

    let submission!: Promise<void>;
    act(() => { submission = result.current.submit(makeSubmitEvent()); });

    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
    expect(result.current.status).toBe('submitting');
    expect(result.current.submissionComplete).toBe(true);
    await act(() => result.current.submit(makeSubmitEvent()));
    expect(updateSession).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRefresh();
      await submission;
    });

    expect(updateSession).toHaveBeenCalledWith(session.id, {
      sessionType: 'Guest Speaker',
      theme: 'Career Stories',
      startsAt: '2026-08-10T17:00:00Z',
      endsAt: '2026-08-10T19:00:00Z',
      description: null,
    });
    expect(onUpdated).toHaveBeenCalledWith({ session });
    expect(result.current).toMatchObject({
      status: 'success',
      statusMessage: 'Session updated successfully.',
    });
  });

  it('reports failures and permits retry', async () => {
    const session = makeProgramSession();
    vi.mocked(updateSession)
      .mockRejectedValueOnce(new Error('Session overlaps another session'))
      .mockResolvedValueOnce({ session });
    const onUpdated = vi.fn();
    const { result } = renderHook(() => useEditSessionModal(session, onUpdated));
    act(() => result.current.setSessionType('Regular'));

    await act(() => result.current.submit(makeSubmitEvent()));
    expect(result.current).toMatchObject({
      status: 'error',
      statusMessage: 'Session overlaps another session',
    });

    await act(() => result.current.submit(makeSubmitEvent()));
    expect(updateSession).toHaveBeenCalledTimes(2);
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('resets workflow state for a different session target', async () => {
    const first = makeProgramSession();
    const second = makeProgramSession({ id: 'session-2', sessionType: 'Guest Speaker' });
    vi.mocked(updateSession).mockRejectedValue(new Error('Update failed'));
    const { result, rerender } = renderHook(
      ({ session }) => useEditSessionModal(session, vi.fn()),
      { initialProps: { session: first } },
    );
    act(() => result.current.setSessionType('Regular'));
    await act(() => result.current.submit(makeSubmitEvent()));
    expect(result.current.status).toBe('error');

    rerender({ session: second });
    await waitFor(() => expect(result.current).toMatchObject({
      status: 'idle',
      statusMessage: '',
      sessionType: 'Guest Speaker',
    }));
  });

  it('preserves the draft and completed save lock when the shared session is replaced', async () => {
    const session = makeProgramSession();
    const saved = makeProgramSession({ theme: 'Saved theme' });
    vi.mocked(updateSession).mockResolvedValue({ session: saved });
    const { result, rerender } = renderHook(({ current }) => useEditSessionModal(current, vi.fn()), {
      initialProps: { current: session },
    });
    act(() => result.current.setSessionType('Guest Speaker'));
    rerender({ current: makeProgramSession({ sessionType: 'Field Trip' }) });
    expect(result.current.sessionType).toBe('Guest Speaker');

    await act(() => result.current.submit(makeSubmitEvent()));
    rerender({ current: saved });
    expect(result.current.status).toBe('success');
    expect(result.current.submissionComplete).toBe(true);
    await act(() => result.current.submit(makeSubmitEvent()));
    expect(updateSession).toHaveBeenCalledOnce();
  });

  it('locks same-tick submissions until the save workflow settles', async () => {
    let resolveUpdate!: () => void;
    vi.mocked(updateSession).mockReturnValue(new Promise(resolve => {
      resolveUpdate = () => resolve({ session: makeProgramSession() });
    }));
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const session = makeProgramSession();
    const { result } = renderHook(() => useEditSessionModal(session, onUpdated));

    await act(async () => result.current.setSessionType('Guest Speaker'));
    let firstSubmit!: Promise<void>;
    act(() => {
      firstSubmit = result.current.submit(makeSubmitEvent());
      void result.current.submit(makeSubmitEvent());
    });

    expect(updateSession).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.submissionComplete).toBe(true));
    resolveUpdate();
    await act(async () => firstSubmit);

    expect(onUpdated).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.status).toBe('success'));
  });
});
