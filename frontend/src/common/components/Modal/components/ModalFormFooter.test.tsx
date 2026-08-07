import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ModalFormFooter from './ModalFormFooter';

describe('ModalFormFooter', () => {
  it('connects the submit button to its form and closes from Cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ModalFormFooter
        formId="example-form"
        submitLabel="Save"
        submitStatus="idle"
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('form', 'example-form');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables both actions while a submission is in progress or complete', () => {
    const { rerender } = render(
      <ModalFormFooter
        formId="example-form"
        submitLabel="Save"
        submitStatus="submitting"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    rerender(
      <ModalFormFooter
        formId="example-form"
        submitLabel="Save"
        submitStatus="success"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('can disable only submit for form-specific validation', () => {
    render(
      <ModalFormFooter
        formId="example-form"
        submitLabel="Save"
        submitStatus="idle"
        submitDisabled
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
