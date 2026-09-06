import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AuthLayout from './AuthLayout';

describe('AuthLayout', () => {
  it('places authentication content inside the shared form panel', () => {
    render(
      <AuthLayout>
        <form aria-label="Sign in">Authentication fields</form>
      </AuthLayout>,
    );

    const form = screen.getByRole('form', { name: 'Sign in' });
    expect(form.parentElement).toHaveClass('auth-form-panel');
    expect(form.closest('.auth-container')).toBeInTheDocument();
  });
});
