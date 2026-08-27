// Owns attachment create/edit initialization, payloads, linked youth, success, and failure recovery.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionAttachment } from '../../../../../../../common/types/cohort';
import { makeCohortSession } from '../../../../../../../tests/factories/session';
import { renderWithQueryClient } from '../../../../../../../tests/queryClientTestUtils';
import SessionAttachmentModal from './SessionAttachmentModal';

const api = vi.hoisted(() => ({
  createSessionAttachment: vi.fn(),
  getSessionRoster: vi.fn(),
  updateSessionAttachment: vi.fn(),
}));

vi.mock('../../../../../../../common/features/programming/api/sessions.api', () => api);

const queryKey = ['sessions'] as const;
const session = makeCohortSession();
const attachment: SessionAttachment = {
  id: 'attachment-1',
  sessionId: session.id,
  title: 'Workshop photo',
  description: 'Youth presenting their work.',
  originalFilename: 'IMG_0042.png',
  mimeType: 'image/png',
  fileSize: 2048,
  createdAt: '2026-07-28T23:30:00.000Z',
  updatedAt: '2026-07-28T23:30:00.000Z',
  createdByName: 'Programming Demo',
  youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
};

describe('SessionAttachmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionRoster.mockResolvedValue([
      {
        youthId: 'youth-1',
        firstName: 'Maya',
        lastName: 'Thompson',
        status: null,
        notes: null,
      },
    ]);
    api.createSessionAttachment.mockResolvedValue({});
    api.updateSessionAttachment.mockResolvedValue({});
  });

  it('uploads a new attachment with normalized fields and selected youth', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const file = new File(['photo'], 'workshop.png', { type: 'image/png' });
    renderWithQueryClient(
      <SessionAttachmentModal
        queryKey={queryKey}
        session={session}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await screen.findByLabelText('Maya Thompson');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Workshop photo  ' } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: '  Youth presenting their work.  ' },
    });
    await user.upload(screen.getByLabelText('File'), file);
    fireEvent.click(screen.getByLabelText('Maya Thompson'));
    fireEvent.submit(screen.getByLabelText('Title').closest('form') as HTMLFormElement);

    await waitFor(() => expect(api.createSessionAttachment).toHaveBeenCalledWith(
      session.id,
      {
        title: 'Workshop photo',
        description: 'Youth presenting their work.',
        youthIds: ['youth-1'],
        file,
      },
    ));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByText('Attachment successfully added.')).toBeInTheDocument();
  });

  it('edits attachment metadata without requesting another file', async () => {
    const onSaved = vi.fn();
    renderWithQueryClient(
      <SessionAttachmentModal
        queryKey={queryKey}
        session={session}
        attachment={attachment}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(await screen.findByLabelText('Maya Thompson')).toBeChecked();
    expect(screen.queryByLabelText('File')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed photo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateSessionAttachment).toHaveBeenCalledWith(
      session.id,
      attachment.id,
      {
        title: 'Renamed photo',
        description: attachment.description,
        youthIds: ['youth-1'],
      },
    ));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByText('Attachment successfully updated.')).toBeInTheDocument();
  });

  it('shows an upload failure and keeps the editor open', async () => {
    const user = userEvent.setup();
    api.createSessionAttachment.mockRejectedValue(new Error('Upload failed'));
    const file = new File(['photo'], 'workshop.png', { type: 'image/png' });
    renderWithQueryClient(
      <SessionAttachmentModal
        queryKey={queryKey}
        session={session}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Workshop photo' } });
    await user.upload(screen.getByLabelText('File'), file);
    fireEvent.submit(screen.getByLabelText('Title').closest('form') as HTMLFormElement);

    expect(await screen.findByText('Upload failed')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add Attachment' })).toBeInTheDocument();
  });

  it('resets selection and status when a different attachment target opens', async () => {
    const user = userEvent.setup();
    api.createSessionAttachment.mockRejectedValue(new Error('Upload failed'));
    const props = { queryKey, onClose: vi.fn(), onSaved: vi.fn() };
    const view = renderWithQueryClient(
      <SessionAttachmentModal session={session} {...props} />,
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Workshop photo' } });
    await user.upload(
      screen.getByLabelText('File'),
      new File(['photo'], 'workshop.png', { type: 'image/png' }),
    );
    fireEvent.submit(screen.getByLabelText('Title').closest('form') as HTMLFormElement);
    expect(await screen.findByText('Upload failed')).toBeInTheDocument();

    view.rerender(<SessionAttachmentModal session={null} {...props} />);
    view.rerender(<SessionAttachmentModal session={session} attachment={attachment} {...props} />);

    expect(await screen.findByLabelText('Maya Thompson')).toBeChecked();
    expect(screen.getByLabelText('Title')).toHaveValue('Workshop photo');
    expect(screen.queryByText('Upload failed')).not.toBeInTheDocument();
  });
});
