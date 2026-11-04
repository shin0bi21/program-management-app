import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NoteModal from './NoteModal';

describe('NoteModal', () => {
  it('owns the shared category and required-note form wiring', () => {
    const onCategoryChange = vi.fn();
    const onDetailsChange = vi.fn();
    const onSubmit = vi.fn();

    render(<NoteModal
      isOpen
      title="Add Note"
      formId="test-note-form"
      categoryLabel="Category"
      category="general"
      categoryOptions={[
        { value: 'general', label: 'General' },
        { value: 'health', label: 'Health' },
      ]}
      details="Current note"
      submitStatus="idle"
      onCategoryChange={onCategoryChange}
      onDetailsChange={onDetailsChange}
      onSubmit={onSubmit}
      onClose={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Health' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note *' }), {
      target: { value: 'Updated note' },
    });
    fireEvent.submit(document.getElementById('test-note-form')!);

    expect(onCategoryChange).toHaveBeenCalledWith('health');
    expect(onDetailsChange).toHaveBeenCalledWith('Updated note');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('locks shared controls while submitting', () => {
    render(<NoteModal
      isOpen
      title="Add Note"
      formId="test-note-form"
      categoryLabel="Status"
      category="new"
      categoryOptions={[{ value: 'new', label: 'New' }]}
      details="Required reason"
      submitStatus="submitting"
      onCategoryChange={vi.fn()}
      onDetailsChange={vi.fn()}
      onSubmit={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: 'Status' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Note *' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
