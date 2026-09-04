import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NoteRow from './NoteRow';

describe('NoteRow', () => {
  it('renders stable note metadata and delegates available actions', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <NoteRow
        ariaLabel="profile note"
        title="Check-in"
        categoryBadge={<span>General</span>}
        date="2026-08-07T12:00:00.000Z"
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText('Check-in')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View profile note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete profile note' }));
    expect(onView).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('does not expose management actions when they are unavailable', () => {
    render(
      <NoteRow
        ariaLabel="profile note"
        title="Read only"
        categoryBadge={<span>General</span>}
        date="2026-08-07T12:00:00.000Z"
        onView={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Edit profile note' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete profile note' })).not.toBeInTheDocument();
  });

  it('supports editing without exposing deletion', () => {
    const onEdit = vi.fn();
    render(<NoteRow ariaLabel="status update" categoryBadge={<span>Contacted</span>}
      date="2026-08-07T12:00:00.000Z" onView={() => undefined} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit status update' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Delete status update' })).not.toBeInTheDocument();
  });
});
