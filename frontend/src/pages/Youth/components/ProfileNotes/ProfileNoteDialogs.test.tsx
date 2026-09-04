import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { YouthProfileNote } from '../../types';
import ProfileNoteDialogs from './ProfileNoteDialogs';

const editorProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./ProfileNoteModal', () => ({
  default: (props: Record<string, unknown>) => {
    editorProps.current = props;
    return <div role="dialog" aria-label="Profile note editor" />;
  },
}));

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
  confirmingDelete: false,
  deleting: false,
  deleteError: '',
  onCloseEditor: vi.fn(),
  onSaved: vi.fn(),
  onCloseDetails: vi.fn(),
  onEdit: vi.fn(),
  onRequestDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  onConfirmDelete: vi.fn().mockResolvedValue(undefined),
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

  it('owns delete confirmation, pending state, and failure presentation', () => {
    const onCancelDelete = vi.fn();
    const onConfirmDelete = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ProfileNoteDialogs
        {...baseProps}
        confirmingDelete
        onCancelDelete={onCancelDelete}
        onConfirmDelete={onConfirmDelete}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Delete Profile Note' })).toHaveTextContent(
      'Delete this profile note? This cannot be undone.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onCancelDelete).toHaveBeenCalledOnce();
    expect(onConfirmDelete).toHaveBeenCalledOnce();

    rerender(<ProfileNoteDialogs {...baseProps} confirmingDelete deleting deleteError="Delete failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Delete failed');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('forwards existing and new editor targets to the profile-note workflow', () => {
    const onCloseEditor = vi.fn();
    const onSaved = vi.fn();
    const { rerender } = render(
      <ProfileNoteDialogs
        {...baseProps}
        selectedNote={null}
        editorTarget={{ youthId: 'youth-1', note }}
        onCloseEditor={onCloseEditor}
        onSaved={onSaved}
      />,
    );

    expect(editorProps.current).toMatchObject({ youthId: 'youth-1', note, onClose: onCloseEditor, onSaved });

    rerender(
      <ProfileNoteDialogs
        {...baseProps}
        selectedNote={null}
        editorTarget={{ youthId: 'youth-2', note: 'new' }}
        onCloseEditor={onCloseEditor}
        onSaved={onSaved}
      />,
    );
    expect(editorProps.current).toMatchObject({
      youthId: 'youth-2',
      note: undefined,
      onClose: onCloseEditor,
      onSaved,
    });
  });
});
