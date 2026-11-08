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

  it('resolves open targets from refreshed records and hides a missing edit target', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ target }) => useSessionNotes({ queryKey: ['sessions'], session: target }),
      { initialProps: { target: session }, wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.query.data).toEqual([note]));
    act(() => {
      result.current.openEdit(note);
      result.current.setDetailNote(note);
    });

    const refreshed = { ...note, details: 'Refreshed details.' };
    act(() => client.setQueryData(['sessions', session.id, 'notes'], [refreshed]));
    const refreshedSession = { ...session, theme: 'Updated session theme' };
    rerender({ target: refreshedSession });

    await waitFor(() => expect(result.current.editNote).toEqual(refreshed));
    expect(result.current.detailNote).toEqual(refreshed);
    expect(result.current.noteTarget).toBe(refreshedSession);

    act(() => client.setQueryData(['sessions', session.id, 'notes'], []));

    await waitFor(() => expect(result.current.noteTarget).toBeNull());
    expect(result.current.editNote).toBeNull();
    expect(result.current.detailNote).toBeNull();
    act(() => result.current.openAdd());
    expect(result.current.noteTarget).toBe(refreshedSession);
    expect(result.current.editNote).toBeNull();
  });

  it('deletes the selected record and clears its editor and viewer', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSessionNotes({
      queryKey: ['sessions'], session,
    }), { wrapper: createQueryClientWrapper(client) });
    await waitFor(() => expect(result.current.query.data).toEqual([note]));
    act(() => {
      result.current.openEdit(note);
      result.current.setDetailNote(note);
      result.current.requestDelete(note);
    });
    vi.mocked(getSessionNotes).mockResolvedValue([]);

    await act(() => result.current.confirmAction!.onConfirm());

    expect(deleteSessionNote).toHaveBeenCalledWith(session.id, note.id);
    await waitFor(() => expect(result.current.noteTarget).toBeNull());
    expect(result.current.detailNote).toBeNull();
  });

  it('keeps a confirmed deletion out of the cache when refresh fails and preserves newer targets', async () => {
    const other = { ...note, id: 'note-2' };
    vi.mocked(getSessionNotes).mockResolvedValue([note, other]);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSessionNotes({
      queryKey: ['sessions'], session,
    }), { wrapper: createQueryClientWrapper(client) });
    await waitFor(() => expect(result.current.query.data).toEqual([note, other]));
    act(() => {
      result.current.openEdit(note);
      result.current.setDetailNote(note);
      result.current.requestDelete(note);
    });
    let failRefresh!: (error: Error) => void;
    vi.mocked(getSessionNotes).mockReturnValue(new Promise((_, reject) => { failRefresh = reject; }));
    let deletion!: Promise<void>;

    act(() => { deletion = result.current.confirmAction!.onConfirm(); });

    await waitFor(() => expect(result.current.query.data).toEqual([other]));
    expect(result.current.noteTarget).toBeNull();
    expect(result.current.editNote).toBeNull();
    expect(result.current.detailNote).toBeNull();
    act(() => {
      result.current.openEdit(other);
      result.current.setDetailNote(other);
    });

    await act(async () => {
      failRefresh(new Error('Refresh failed'));
      await deletion;
    });

    expect(client.getQueryData(['sessions', session.id, 'notes'])).toEqual([other]);
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.noteTarget).toEqual(session);
    expect(result.current.editNote).toEqual(other);
    expect(result.current.detailNote).toEqual(other);
  });

  it('ignores a delete completion after the selected session changes', async () => {
    let resolveDelete!: () => void;
    vi.mocked(deleteSessionNote).mockReturnValue(new Promise(resolve => {
      resolveDelete = () => resolve({} as never);
    }));
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ target }) => useSessionNotes({ queryKey: ['sessions'], session: target }),
      { initialProps: { target: session }, wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.query.data).toEqual([note]));
    act(() => {
      result.current.openEdit(note);
      result.current.requestDelete(note);
    });
    let deletion!: Promise<void>;
    act(() => { deletion = result.current.confirmAction!.onConfirm(); });

    rerender({ target: nextSession });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    const readsAfterTransition = vi.mocked(getSessionNotes).mock.calls.length;
    expect(result.current.noteTarget).toBeNull();

    resolveDelete();
    await act(async () => deletion);

    expect(getSessionNotes).toHaveBeenCalledTimes(readsAfterTransition);
    expect(result.current.confirmAction).toBeNull();
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
