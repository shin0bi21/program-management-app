import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import type { ComponentProps } from 'react';
import NoteModal from './NoteModal';

type TestNoteProps = Omit<ComponentProps<typeof NoteModal>, 'detailsField' | 'onSubmit'> & {
  onSubmit: (values: { details: string }) => void;
};

/** Mounts the shared modal with a real registered note field. @example <TestNote {...props} /> */
function TestNote({ onSubmit, ...props }: TestNoteProps) {
  const { register, handleSubmit } = useForm({ defaultValues: { details: 'Current note' } });
  return <NoteModal {...props} detailsField={register('details')} onSubmit={handleSubmit(onSubmit)} />;
}

describe('NoteModal', () => {
  it('owns the shared category and required-note form wiring', async () => {
    const onCategoryChange = vi.fn();
    const onSubmit = vi.fn();

    render(<TestNote
      isOpen
      title="Add Note"
      formId="test-note-form"
      categoryLabel="Category"
      category="general"
      categoryOptions={[
        { id: 'general', name: 'General' },
        { id: 'health', name: 'Health' },
      ]}
      submitStatus="idle"
      onCategoryChange={onCategoryChange}
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
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ details: 'Updated note' }, expect.anything()));
  });

  it('locks shared controls while submitting', () => {
    render(<TestNote
      isOpen
      title="Add Note"
      formId="test-note-form"
      categoryLabel="Status"
      category="new"
      categoryOptions={[{ id: 'new', name: 'New' }]}
      submitStatus="submitting"
      onCategoryChange={vi.fn()}
      onSubmit={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: 'Status' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Note *' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
