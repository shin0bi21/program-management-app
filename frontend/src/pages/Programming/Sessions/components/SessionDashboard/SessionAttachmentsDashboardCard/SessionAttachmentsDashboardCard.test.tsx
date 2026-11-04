import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionAttachment } from '../../../types';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import { renderWithQueryClient } from '../../../../../../tests/queryClientTestUtils';
import SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard';

const queryKey = ['sessions'] as const;
const api = vi.hoisted(() => ({
  deleteSessionAttachment: vi.fn(),
  getSessionAttachments: vi.fn(),
}));
const childProps = vi.hoisted(() => ({
  editor: null as Record<string, unknown> | null,
  viewer: null as Record<string, unknown> | null,
}));

vi.mock('../../../sessions.api', () => api);
vi.mock('./SessionAttachmentModal/SessionAttachmentModal', () => ({
  default: (props: Record<string, unknown>) => {
    childProps.editor = props;
    return props.session ? <div role="dialog" aria-label="Attachment editor" /> : null;
  },
}));
vi.mock('./SessionAttachmentViewerModal/SessionAttachmentViewerModal', () => ({
  default: (props: Record<string, unknown>) => {
    childProps.viewer = props;
    return props.attachment ? <div role="dialog" aria-label="Attachment viewer" /> : null;
  },
}));

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

describe('SessionAttachmentsDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    childProps.editor = null;
    childProps.viewer = null;
    api.getSessionAttachments.mockResolvedValue([]);
    api.deleteSessionAttachment.mockResolvedValue({});
  });

  it('owns unselected, empty, and add-attachment states', async () => {
    const view = renderWithQueryClient(
      <SessionAttachmentsDashboardCard queryKey={queryKey} session={null} canWrite />,
    );
    expect(screen.getByText('No session selected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add attachments' })).toBeDisabled();
    expect(api.getSessionAttachments).not.toHaveBeenCalled();

    view.unmount();
    renderWithQueryClient(
      <SessionAttachmentsDashboardCard queryKey={queryKey} session={session} canWrite />,
    );
    expect(screen.getByRole('status', { name: 'Loading attachments…' })).toBeInTheDocument();
    expect(await screen.findByText('No attachments.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add attachments' }));
    expect(screen.getByRole('dialog', { name: 'Attachment editor' })).toBeInTheDocument();
    expect(childProps.editor).toMatchObject({
      session,
      attachment: null,
      queryKey,
    });
  });

  it('lists attachments and passes the selected attachment to the viewer', async () => {
    api.getSessionAttachments.mockResolvedValue([attachment]);
    renderWithQueryClient(<SessionAttachmentsDashboardCard queryKey={queryKey} session={session} canWrite />);

    expect(await screen.findByText(attachment.title)).toBeInTheDocument();
    expect(screen.queryByText(attachment.originalFilename)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `View ${attachment.title}` }));
    expect(screen.getByRole('dialog', { name: 'Attachment viewer' })).toBeInTheDocument();
    expect(childProps.viewer).toMatchObject({ session, attachment });
  });

  it('passes the selected attachment to the editor', async () => {
    api.getSessionAttachments.mockResolvedValue([attachment]);
    renderWithQueryClient(<SessionAttachmentsDashboardCard queryKey={queryKey} session={session} canWrite />);

    await screen.findByText(attachment.title);
    fireEvent.click(screen.getByRole('button', { name: `Edit ${attachment.title}` }));
    expect(screen.getByRole('dialog', { name: 'Attachment editor' })).toBeInTheDocument();
    expect(childProps.editor).toMatchObject({ session, attachment });
  });

  it('deletes through the card-owned confirmation and refreshes the list', async () => {
    api.getSessionAttachments.mockResolvedValueOnce([attachment]).mockResolvedValue([]);
    renderWithQueryClient(<SessionAttachmentsDashboardCard queryKey={queryKey} session={session} canWrite />);

    await screen.findByText(attachment.title);
    fireEvent.click(screen.getByRole('button', { name: `Delete ${attachment.title}` }));
    const deleteModal = screen.getByRole('heading', { name: 'Delete Attachment' }).closest('.modal-container');
    fireEvent.click(within(deleteModal as HTMLElement).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(api.deleteSessionAttachment).toHaveBeenCalledWith(
      session.id,
      attachment.id,
    ));
    await waitFor(() => expect(screen.queryByText(attachment.title)).not.toBeInTheDocument());
  });
});
