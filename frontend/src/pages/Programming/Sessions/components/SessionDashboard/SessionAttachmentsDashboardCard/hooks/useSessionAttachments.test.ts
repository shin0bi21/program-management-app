import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PageErrorItem } from '../../../../../../../common/components/PageErrorOverlay/PageErrorOverlay';
import { deleteSessionAttachment, getSessionAttachments } from '../../../../../../../common/features/programming/api/sessions.api';
import type { SessionAttachment } from '../../../../../../../common/types/cohort';
import { makeCohortSession } from '../../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../../tests/queryClientTestUtils';
import { useSessionAttachments } from './useSessionAttachments';

vi.mock('../../../../../../../common/features/programming/api/sessions.api', () => ({
  deleteSessionAttachment: vi.fn(),
  getSessionAttachments: vi.fn(),
}));

const session = makeCohortSession();
const nextSession = makeCohortSession({ id: 'session-2' });
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

  it('reports query errors with a retry action that reloads the owner', async () => {
    vi.mocked(getSessionAttachments)
      .mockRejectedValueOnce(new Error('Attachments unavailable'))
      .mockResolvedValueOnce([attachment]);
    const onErrorChange = vi.fn();
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSessionAttachments({
      queryKey: ['sessions'], session, onErrorChange,
    }), { wrapper: createQueryClientWrapper(client) });

    await waitFor(() => expect(onErrorChange).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Could not load session attachments.',
      action: expect.objectContaining({ label: 'Retry' }),
    })));
    const error = onErrorChange.mock.calls
      .map(([value]) => value as PageErrorItem | null)
      .find(value => value?.message === 'Could not load session attachments.');

    await act(() => error?.action?.onClick());

    await waitFor(() => expect(result.current.query.data).toEqual([attachment]));
    await waitFor(() => expect(onErrorChange).toHaveBeenLastCalledWith(null));
  });
});
