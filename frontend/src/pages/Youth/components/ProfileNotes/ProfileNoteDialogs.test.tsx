import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { YouthProfileNote } from '../../types';
import ProfileNoteDialogs from './ProfileNoteDialogs';

const note: YouthProfileNote = {
  id: 'note-1',
  youthId: 'youth-1',
  category: 'preference',
  details: 'Prefers written instructions.',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
};

const baseProps = {
  editorTarget: null,
  selectedNote: note,
  canManage: true,
  confirmAction: null,
  onCloseEditor: vi.fn(),
  onSaved: vi.fn(),
  onCloseDetails: vi.fn(),
  onEdit: vi.fn(),
  onRequestDelete: vi.fn(),
  onCloseConfirmation: vi.fn(),
};

describe('ProfileNoteDialogs', () => {
  it('renders note details and delegates available management actions', () => {
    const onEdit = vi.fn();
    const onRequestDelete = vi.fn();
    render(<ProfileNoteDialogs {...baseProps} onEdit={onEdit} onRequestDelete={onRequestDelete} />);

    expect(screen.getByRole('dialog', { name: 'Profile Note' })).toBeInTheDocument();
    expect(screen.getByText('Prefers written instructions.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onEdit).toHaveBeenCalledWith(note);
    expect(onRequestDelete).toHaveBeenCalledWith(note);
  });
});
