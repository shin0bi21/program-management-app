import { render, screen, within } from '@testing-library/react';
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Homepage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /programming/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /organizational history/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /interested/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /meet our team/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /partners/i })).toBeInTheDocument();

    const teamSection = screen.getByRole('heading', { name: /meet our team/i }).closest('section');
    expect(teamSection).not.toBeNull();
    const teamCards = within(teamSection!).getAllByRole('listitem');
    expect(teamCards[0]).toHaveTextContent('Quinton Macnevins');
    expect(teamCards[0]).toHaveTextContent(
      'Drawing from both his professional experience and his lived experience as a former Crown ward',
    );
  });
});
