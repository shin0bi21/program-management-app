import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteSessionAttachment, getSessionAttachments } from '../../../../sessions.api';
import type { SessionAttachment } from '../../../../types';
import { makeProgramSession } from '../../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../../tests/queryClientTestUtils';
import { useSessionAttachments } from './useSessionAttachments';

vi.mock('../../../../sessions.api', () => ({
  deleteSessionAttachment: vi.fn(),
  getSessionAttachments: vi.fn(),
}));

const session = makeProgramSession();
const nextSession = makeProgramSession({ id: 'session-2' });
const attachment: SessionAttachment = {
  id: 'attachment-1', sessionId: session.id, title: 'Workshop photo', description: null,
  originalFilename: 'photo.png', mimeType: 'image/png', fileSize: 1024,
  createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-01T12:00:00.000Z',
  createdByName: 'Staff Member', youth: [],
};

describe('useSessionAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionAttachments).mockResolvedValue([attachment]);
    vi.mocked(deleteSessionAttachment).mockResolvedValue({} as never);
  });

  it('clears editor, viewer, and confirmation targets when the session changes', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ target }) => useSessionAttachments({ queryKey: ['sessions'], session: target }),
      { initialProps: { target: session }, wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.query.data).toEqual([attachment]));

    act(() => {
      result.current.openEdit(attachment);
      result.current.setDetailAttachment(attachment);
      result.current.requestDelete(attachment);
    });
    expect(result.current.attachmentTarget).toEqual(session);
    expect(result.current.editAttachment).toEqual(attachment);
    expect(result.current.detailAttachment).toEqual(attachment);
    expect(result.current.confirmAction).not.toBeNull();

    rerender({ target: nextSession });
    await waitFor(() => expect(result.current).toMatchObject({
      attachmentTarget: null, editAttachment: null, detailAttachment: null, confirmAction: null,
    }));
  });

  it('resolves open targets from refreshed records and hides a missing edit target', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ target }) => useSessionAttachments({ queryKey: ['sessions'], session: target }),
      { initialProps: { target: session }, wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.query.data).toEqual([attachment]));
    act(() => {
      result.current.openEdit(attachment);
      result.current.setDetailAttachment(attachment);
    });

    const refreshed = { ...attachment, title: 'Refreshed title' };
    act(() => client.setQueryData(['sessions', session.id, 'attachments'], [refreshed]));
    const refreshedSession = { ...session, title: 'Updated session title' };
    rerender({ target: refreshedSession });

    await waitFor(() => expect(result.current.editAttachment).toEqual(refreshed));
    expect(result.current.detailAttachment).toEqual(refreshed);
    expect(result.current.attachmentTarget).toBe(refreshedSession);

    act(() => client.setQueryData(['sessions', session.id, 'attachments'], []));

    await waitFor(() => expect(result.current.attachmentTarget).toBeNull());
    expect(result.current.editAttachment).toBeNull();
    expect(result.current.detailAttachment).toBeNull();
    act(() => result.current.openAdd());
    expect(result.current.attachmentTarget).toBe(refreshedSession);
    expect(result.current.editAttachment).toBeNull();
  });

  it('deletes the selected record and clears its editor and viewer', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSessionAttachments({
      queryKey: ['sessions'], session,
    }), { wrapper: createQueryClientWrapper(client) });
    await waitFor(() => expect(result.current.query.data).toEqual([attachment]));
    act(() => {
      result.current.openEdit(attachment);
      result.current.setDetailAttachment(attachment);
      result.current.requestDelete(attachment);
    });
    vi.mocked(getSessionAttachments).mockResolvedValue([]);

    await act(() => result.current.confirmAction!.onConfirm());

    expect(deleteSessionAttachment).toHaveBeenCalledWith(session.id, attachment.id);
    await waitFor(() => expect(result.current.attachmentTarget).toBeNull());
    expect(result.current.detailAttachment).toBeNull();
  });

  it('keeps a confirmed deletion out of the cache when refresh fails and preserves newer targets', async () => {
    const other = { ...attachment, id: 'attachment-2' };
    vi.mocked(getSessionAttachments).mockResolvedValue([attachment, other]);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSessionAttachments({
      queryKey: ['sessions'], session,
    }), { wrapper: createQueryClientWrapper(client) });
    await waitFor(() => expect(result.current.query.data).toEqual([attachment, other]));
    act(() => {
      result.current.openEdit(attachment);
      result.current.setDetailAttachment(attachment);
      result.current.requestDelete(attachment);
    });
    let failRefresh!: (error: Error) => void;
    vi.mocked(getSessionAttachments).mockReturnValue(new Promise((_, reject) => { failRefresh = reject; }));
    let deletion!: Promise<void>;

    act(() => { deletion = result.current.confirmAction!.onConfirm(); });

    await waitFor(() => expect(result.current.query.data).toEqual([other]));
    expect(result.current.attachmentTarget).toBeNull();
    expect(result.current.editAttachment).toBeNull();
    expect(result.current.detailAttachment).toBeNull();
    act(() => {
      result.current.openEdit(other);
      result.current.setDetailAttachment(other);
    });

    await act(async () => {
      failRefresh(new Error('Refresh failed'));
      await deletion;
    });

    expect(client.getQueryData(['sessions', session.id, 'attachments'])).toEqual([other]);
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.attachmentTarget).toEqual(session);
    expect(result.current.editAttachment).toEqual(other);
    expect(result.current.detailAttachment).toEqual(other);
  });

  it('ignores a delete completion after the selected session changes', async () => {
    let resolveDelete!: () => void;
    vi.mocked(deleteSessionAttachment).mockReturnValue(new Promise(resolve => {
      resolveDelete = () => resolve({} as never);
    }));
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ target }) => useSessionAttachments({ queryKey: ['sessions'], session: target }),
      { initialProps: { target: session }, wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.query.data).toEqual([attachment]));
    act(() => {
      result.current.openEdit(attachment);
      result.current.requestDelete(attachment);
    });
    let deletion!: Promise<void>;
    act(() => { deletion = result.current.confirmAction!.onConfirm(); });

    rerender({ target: nextSession });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    const readsAfterTransition = vi.mocked(getSessionAttachments).mock.calls.length;
    expect(result.current.attachmentTarget).toBeNull();

    resolveDelete();
    await act(async () => deletion);

    expect(getSessionAttachments).toHaveBeenCalledTimes(readsAfterTransition);
    expect(result.current.confirmAction).toBeNull();
  });

});
