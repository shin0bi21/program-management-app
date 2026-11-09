import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { forgotPassword } from '../../../auth/auth.api';
import ForgotPassword from './ForgotPassword';

vi.mock('../../../auth/auth.api', () => ({ forgotPassword: vi.fn() }));

describe('ForgotPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates the rendered email field before requesting a reset', async () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }).closest('form')!);

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Back to login/ })).toHaveAttribute('href', '/login');
  });

  it('renders the success state after a valid submission', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({});
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }).closest('form')!);

    expect(await screen.findByRole('status')).toHaveTextContent('Password reset email sent');
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });
});
