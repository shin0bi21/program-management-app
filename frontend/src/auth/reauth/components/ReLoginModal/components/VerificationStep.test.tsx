// Scope: verifies the verification step's code, resend, error, and submission wiring.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VerificationStep from './VerificationStep';

describe('VerificationStep', () => {
  it('renders verification context and wires verification actions', async () => {
    const onSubmit = vi.fn();
    const onResend = vi.fn();

    render(<VerificationStep
      email="staff@example.com"
      error="Invalid code"
      resending={false}
      onSubmit={onSubmit}
      onResend={onResend}
    />);

    expect(screen.getByText('staff@example.com')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code');

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Verify' }).closest('form')!);

    expect(onResend).toHaveBeenCalledOnce();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledExactlyOnceWith('654321'));
  });
});
