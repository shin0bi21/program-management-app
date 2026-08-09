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
    fireEvent.click(screen.getByRole('button', { name: 'View Check-in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Check-in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Check-in' }));
    expect(onView).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('does not expose management actions when they are unavailable', () => {
    render(
      <NoteRow
        title="Read only"
        categoryBadge={<span>General</span>}
        date="2026-08-07T12:00:00.000Z"
        onView={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Edit Read only' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Read only' })).not.toBeInTheDocument();
  });
});
