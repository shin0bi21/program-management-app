import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Account from './Account';

const mockUsePrograms = vi.fn();

vi.mock('../../../common/components/Header/Header', () => ({
  default: () => <div data-testid="header" />,
}));
vi.mock('../../../common/utils/storage', () => ({
  getUser: () => ({
    firstName: 'Sofia',
    lastName: 'Soft Skills',
    email: 'softskills.staff@local.test',
  }),
}));
vi.mock('../../../common/context/AuthContext', () => ({
  useAuth: () => ({ role: 'staff' }),
}));
vi.mock('../../../common/hooks/usePrograms', () => ({
  usePrograms: (options: unknown) => mockUsePrograms(options),
}));

describe('My Account', () => {
  beforeEach(() => {
    mockUsePrograms.mockReturnValue({
      programs: [
        {
          id: 'program-1',
          name: 'Soft Skills',
          rosterMode: 'enrolled',
          minAge: 12,
          maxAge: 15,
        },
        {
          id: 'program-2',
          name: 'Drop In',
          rosterMode: 'open',
          minAge: null,
          maxAge: null,
        },
      ],
      loading: false,
      error: '',
    });
  });

  it('shows identity, role, and accessible programs', () => {
    render(<Account />);

    expect(screen.getByText('Sofia Soft Skills')).toBeInTheDocument();
    expect(screen.getByText('softskills.staff@local.test')).toBeInTheDocument();
    expect(screen.getByText('staff')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills, Drop In')).toBeInTheDocument();
    expect(mockUsePrograms).toHaveBeenCalledWith({ assignedOnly: true });
  });
});
