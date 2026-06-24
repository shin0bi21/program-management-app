import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../common/utils/clientErrors';
import Homepage from './Homepage';

const mockSubmitCohortInterest = vi.fn();

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

vi.mock('./api/homepage.api', () => ({
  submitCohortInterest: (...args: unknown[]) => mockSubmitCohortInterest(...args),
}));

describe('Homepage cohort form', () => {
  beforeEach(() => {
    mockSubmitCohortInterest.mockReset();
    mockSubmitCohortInterest.mockResolvedValue({ message: 'ok' });
  });

  it('submits the inline cohort form and shows the thank-you overlay', async () => {
    render(
      <MemoryRouter>
        <Homepage />
      </MemoryRouter>,
    );

    fireEvent.change(document.getElementById('cohort-youthName')!, { target: { value: 'Jordan Test' } });
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } });
    fireEvent.change(document.getElementById('cohort-email')!, { target: { value: 'jordan@test.local' } });
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockSubmitCohortInterest).toHaveBeenCalledWith(expect.objectContaining({
        youthName: 'Jordan Test',
        age: 14,
        email: 'jordan@test.local',
        discoverySource: 'online',
      }));
    });

    expect(screen.getByText(/thank you for your submission/i)).toBeInTheDocument();
    expect((document.getElementById('cohort-youthName') as HTMLInputElement).value).toBe('');
  });

  it('shows validation feedback when neither email nor phone is provided', async () => {
    mockSubmitCohortInterest.mockRejectedValue(
      new ApiError(400, 'Validation failed', [
        { field: 'body.email', message: 'Provide an email or phone number' },
        { field: 'body.phoneNumber', message: 'Provide an email or phone number' },
      ]),
    );

    render(
      <MemoryRouter>
        <Homepage />
      </MemoryRouter>,
    );

    fireEvent.change(document.getElementById('cohort-youthName')!, { target: { value: 'Jordan Test' } });
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/provide an email or phone number/i).length).toBeGreaterThan(0);
    });
  });
});
