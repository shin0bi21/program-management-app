// Scope: verifies the password step's field, error, and submission wiring.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PasswordStep from './PasswordStep';

describe('PasswordStep', () => {
  it('renders authentication context and submits the entered password', async () => {
    const onSubmit = vi.fn();

    render(<PasswordStep
      email="staff@example.com"
      error="Try again"
      onSubmit={onSubmit}
    />);

    expect(screen.getByLabelText('Email')).toHaveValue('staff@example.com');
    expect(screen.getByRole('alert')).toHaveTextContent('Try again');

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'updated-secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Continue' }).closest('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith('updated-secret'));
  });
});
