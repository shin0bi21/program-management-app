import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PageMessageItem } from '../../../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import { deleteSessionNote, getSessionNotes } from '../../../../sessions.api';
import type { SessionNote } from '../../../../types';
import { makeProgramSession } from '../../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../../tests/queryClientTestUtils';
import { useSessionNotes } from './useSessionNotes';

vi.mock('../../../../sessions.api', () => ({
  deleteSessionNote: vi.fn(),
  getSessionNotes: vi.fn(),
}));

const session = makeProgramSession();
const nextSession = makeProgramSession({ id: 'session-2' });
const note: SessionNote = {
  id: 'note-1', sessionId: session.id, category: 'achievement',
  details: 'Led the opening activity.', createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z', createdByName: 'Staff Member', youth: [],
};

describe('useSessionNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionNotes).mockResolvedValue([note]);
    vi.mocked(deleteSessionNote).mockResolvedValue({} as never);
  });

  it('clears editor, viewer, and confirmation targets when the session changes', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ target }) => useSessionNotes({ queryKey: ['sessions'], session: target }),
      { initialProps: { target: session }, wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.query.data).toEqual([note]));

    act(() => {
      result.current.openEdit(note);
      result.current.setDetailNote(note);
      result.current.requestDelete(note);
    });
    expect(result.current.noteTarget).toEqual(session);
    expect(result.current.editNote).toEqual(note);
    expect(result.current.detailNote).toEqual(note);
    expect(result.current.confirmAction).not.toBeNull();

    rerender({ target: nextSession });
    await waitFor(() => expect(result.current).toMatchObject({
      noteTarget: null, editNote: null, detailNote: null, confirmAction: null,
    }));
  });

  it('reports query errors with a retry action that reloads the owner', async () => {
    vi.mocked(getSessionNotes)
      .mockRejectedValueOnce(new Error('Notes unavailable'))
      .mockResolvedValueOnce([note]);
    const onMessageChange = vi.fn();
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSessionNotes({
      queryKey: ['sessions'], session, onMessageChange,
    }), { wrapper: createQueryClientWrapper(client) });

    await waitFor(() => expect(onMessageChange).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Could not load session notes.',
      action: expect.objectContaining({ label: 'Retry' }),
    })));
    const error = onMessageChange.mock.calls
      .map(([value]) => value as PageMessageItem | null)
      .find(value => value?.message === 'Could not load session notes.');

    await act(() => error?.action?.onClick());

    await waitFor(() => expect(result.current.query.data).toEqual([note]));
    await waitFor(() => expect(onMessageChange).toHaveBeenLastCalledWith(null));
  });
});
