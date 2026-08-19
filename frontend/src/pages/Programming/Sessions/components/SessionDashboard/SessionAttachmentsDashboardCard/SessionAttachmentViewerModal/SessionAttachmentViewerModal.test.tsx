// Scope: verifies attachment preview/download states, zoom controls, errors, and browser-resource cleanup.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionAttachment } from '../../../../../../../common/types/cohort';
import { makeCohortSession } from '../../../../../../../tests/factories/session';
import { renderWithQueryClient } from '../../../../../../../tests/queryClientTestUtils';
import SessionAttachmentViewerModal from './SessionAttachmentViewerModal';

const api = vi.hoisted(() => ({
  downloadSessionAttachment: vi.fn(),
  getSessionAttachmentFile: vi.fn(),
}));
const panzoom = vi.hoisted(() => ({
  destroy: vi.fn(),
  reset: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomWithWheel: vi.fn(),
}));

vi.mock('../../../../../../../common/features/programming/api/sessions.api', () => api);
vi.mock('@panzoom/panzoom', () => ({
  default: vi.fn(() => panzoom),
}));

const session = makeCohortSession();
const attachment: SessionAttachment = {
  id: 'attachment-1',
  sessionId: session.id,
  title: 'Workshop photo',
  description: null,
  originalFilename: 'workshop.png',
  mimeType: 'image/png',
  fileSize: 2048,
  createdAt: '2026-07-28T23:30:00.000Z',
  updatedAt: '2026-07-28T23:30:00.000Z',
  createdByName: 'Programming Demo',
  youth: [],
};

describe('SessionAttachmentViewerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionAttachmentFile.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
    api.downloadSessionAttachment.mockResolvedValue(undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:attachment-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('loads an image preview, owns zoom controls, and releases viewer resources', async () => {
    const view = renderWithQueryClient(
      <SessionAttachmentViewerModal
        session={session}
        attachment={attachment}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('img', { name: attachment.title })).toHaveAttribute(
      'src',
      'blob:attachment-preview',
    );
    expect(api.getSessionAttachmentFile).toHaveBeenCalledWith(
      session.id,
      attachment.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(panzoom.zoomIn).toHaveBeenCalledWith({ animate: true });
    expect(panzoom.zoomOut).toHaveBeenCalledWith({ animate: true });
    expect(panzoom.reset).toHaveBeenCalledWith({ animate: true });

    view.unmount();
    expect(panzoom.destroy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-preview');
  });

  it('uses the download fallback for file types that cannot be previewed', async () => {
    const documentAttachment = {
      ...attachment,
      title: 'Workshop document',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalFilename: 'workshop.docx',
    };
    const onClose = vi.fn();
    renderWithQueryClient(
      <SessionAttachmentViewerModal
        session={session}
        attachment={documentAttachment}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(/cannot be previewed/i)).toBeInTheDocument();
    expect(api.getSessionAttachmentFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(api.downloadSessionAttachment).toHaveBeenCalledWith(
      session.id,
      documentAttachment,
    ));
    fireEvent.click(screen.getByText('Close', { selector: 'button' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows preview failures without closing the viewer', async () => {
    api.getSessionAttachmentFile.mockRejectedValue(new Error('Preview unavailable'));
    renderWithQueryClient(
      <SessionAttachmentViewerModal
        session={session}
        attachment={attachment}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Preview unavailable');
    expect(screen.getByRole('dialog', { name: attachment.title })).toBeInTheDocument();
  });
});
