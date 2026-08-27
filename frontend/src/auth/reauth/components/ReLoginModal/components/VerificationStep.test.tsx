// Scope: verifies the verification step's code, resend, error, and submission wiring.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VerificationStep from './VerificationStep';

describe('VerificationStep', () => {
  it('renders verification context and wires verification actions', () => {
    const onCodeChange = vi.fn();
    const onSubmit = vi.fn();
    const onResend = vi.fn();

    render(<VerificationStep
      email="staff@example.com"
      code="123456"
      error="Invalid code"
      submitting={false}
      resending={false}
      onCodeChange={onCodeChange}
      onSubmit={onSubmit}
      onResend={onResend}
    />);

    expect(screen.getByText('staff@example.com')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code');

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Verify' }).closest('form')!);

    expect(onCodeChange).toHaveBeenCalledWith('654321');
    expect(onResend).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
