import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateSession } from '../../../sessions.api';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import { useEditSessionModal } from './useEditSessionModal';

vi.mock('../../../sessions.api', () => ({ updateSession: vi.fn() }));
vi.mock('../../../hooks/data/useSessionTypes', () => ({
  useSessionTypes: () => ({ sessionTypes: [] }),
}));

function makeSubmitEvent() {
  const form = document.createElement('form');
  for (const [name, value] of [
    ['theme', ' Career Stories '],
    ['startsAt', '2026-08-10T13:00'],
    ['endsAt', '2026-08-10T15:00'],
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
    const session = makeCohortSession();
    vi.mocked(updateSession).mockResolvedValue(session);
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditSessionModal(session, onUpdated));
    act(() => result.current.setSessionTypeId('type-2'));

    await act(() => result.current.submit(makeSubmitEvent()));

    expect(updateSession).toHaveBeenCalledWith(session.id, {
      sessionTypeId: 'type-2',
      theme: 'Career Stories',
      startsAt: new Date('2026-08-10T13:00').toISOString(),
      endsAt: new Date('2026-08-10T15:00').toISOString(),
      description: null,
    });
    expect(onUpdated).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({
      status: 'success',
      statusMessage: 'Session updated successfully.',
    });
  });

  it('reports failures and permits retry', async () => {
    const session = makeCohortSession();
    vi.mocked(updateSession)
      .mockRejectedValueOnce(new Error('Session overlaps another session'))
      .mockResolvedValueOnce(session);
    const onUpdated = vi.fn();
    const { result } = renderHook(() => useEditSessionModal(session, onUpdated));
    act(() => result.current.setSessionTypeId('type-1'));

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
    const first = makeCohortSession();
    const second = makeCohortSession({ id: 'session-2', sessionTypeId: 'type-2' });
    vi.mocked(updateSession).mockRejectedValue(new Error('Update failed'));
    const { result, rerender } = renderHook(
      ({ session }) => useEditSessionModal(session, vi.fn()),
      { initialProps: { session: first } },
    );
    act(() => result.current.setSessionTypeId('type-1'));
    await act(() => result.current.submit(makeSubmitEvent()));
    expect(result.current.status).toBe('error');

    rerender({ session: second });
    await waitFor(() => expect(result.current).toMatchObject({
      status: 'idle',
      statusMessage: '',
      sessionTypeId: 'type-2',
    }));
  });

  it('locks same-tick submissions until the save workflow settles', async () => {
    let resolveUpdate!: () => void;
    vi.mocked(updateSession).mockReturnValue(new Promise(resolve => {
      resolveUpdate = () => resolve(makeCohortSession());
    }));
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const session = makeCohortSession();
    const { result } = renderHook(() => useEditSessionModal(session, onUpdated));

    await act(async () => result.current.setSessionTypeId('type-2'));
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
