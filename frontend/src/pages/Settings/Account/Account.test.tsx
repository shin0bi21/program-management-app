import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Account from './Account';

const mockUseAccountData = vi.fn();

vi.mock('./hooks/data/useAccountData', () => ({
  default: () => mockUseAccountData(),
}));

describe('My Account', () => {
  beforeEach(() => {
    mockUseAccountData.mockReturnValue({
      name: 'Sofia Soft Skills',
      email: 'softskills.staff@local.test',
      role: 'staff',
      programNames: 'Soft Skills, Drop In',
      programsLoading: false,
      programsError: null,
      retryPrograms: vi.fn(),
    });
  });

  it('shows identity, role, and accessible programs', () => {
    render(<Account />);

    expect(screen.getByText('Sofia Soft Skills')).toBeInTheDocument();
    expect(screen.getByText('softskills.staff@local.test')).toBeInTheDocument();
    expect(screen.getByText('staff')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills, Drop In')).toBeInTheDocument();
  });

  it('labels the project manager role without exposing its stored identifier', () => {
    mockUseAccountData.mockReturnValue({
      ...mockUseAccountData(),
      role: 'project_manager',
    });

    render(<Account />);

    expect(screen.getByText('Project Manager')).toBeInTheDocument();
  });

  it('reports program failures through the page overlay and retries them', () => {
    const retryPrograms = vi.fn();
    mockUseAccountData.mockReturnValue({
      name: 'Sofia Soft Skills',
      email: 'softskills.staff@local.test',
      role: 'staff',
      programNames: '',
      programsLoading: false,
      programsError: 'Could not load assigned programs.',
      retryPrograms,
    });

    render(<Account />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load assigned programs.');
    expect(retryPrograms).toHaveBeenCalledTimes(1);
  });
});
