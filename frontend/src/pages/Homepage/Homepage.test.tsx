import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Homepage from './Homepage';

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    loading: false,
    permissions: [],
    role: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('Homepage', () => {
  it('renders the public homepage sections', () => {
    render(
      <MemoryRouter>
        <Homepage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /programming/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /organizational history/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /interested/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /meet our team/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /partners/i })).toBeInTheDocument();
  });
});
