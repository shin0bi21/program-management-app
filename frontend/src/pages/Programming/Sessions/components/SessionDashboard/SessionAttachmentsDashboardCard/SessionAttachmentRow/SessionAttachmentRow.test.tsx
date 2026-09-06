import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SessionAttachment } from '../../../../types';
import SessionAttachmentRow from './SessionAttachmentRow';

const attachment: SessionAttachment = {
  id: 'attachment-1',
  sessionId: 'session-1',
  title: 'Workshop photo',
  description: 'Youth presenting their work.',
  originalFilename: 'workshop.png',
  mimeType: 'image/png',
  fileSize: 2048,
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
  youth: [],
};

describe('SessionAttachmentRow', () => {
  it('renders the attachment and delegates every available action', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <SessionAttachmentRow
        attachment={attachment}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText('Workshop photo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Workshop photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Workshop photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Workshop photo' }));

    expect(onView).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('keeps viewing available without exposing partial management actions', () => {
    render(<SessionAttachmentRow attachment={attachment} onView={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'View Workshop photo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Workshop photo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Workshop photo' })).not.toBeInTheDocument();
  });
});
