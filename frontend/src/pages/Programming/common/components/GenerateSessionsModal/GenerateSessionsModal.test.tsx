// Scope: verifies Generate Sessions field composition and pending-state wiring.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProgramCohort } from '../../../../../common/types/cohort';
import render from '../../../../../tests/renderWithQueryClient';
import GenerateSessionsModal from './GenerateSessionsModal';

const generateSessions = vi.fn();
const regularTypeId = '00000000-0000-4000-8000-000000000001';

vi.mock('../../../../../common/features/programming/api/sessions.api', () => ({
  generateSessions: (...args: unknown[]) => generateSessions(...args),
  getSessionTypes: () => Promise.resolve([{ id: regularTypeId, name: 'Regular' }]),
}));

const cohort: ProgramCohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-summer-2026',
  cycleName: 'Summer 2026',
  name: 'Summer 2026',
  startsOn: '2026-07-01',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 5,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

describe('GenerateSessionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSessions.mockResolvedValue({ sessions: [{ id: 'session-1' }] });
  });

  it('renders fixed-cohort weekly fields without a cohort selector', async () => {
    render(<GenerateSessionsModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Cohort' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day of week' })).toHaveTextContent('Tuesday');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    expect(screen.getByLabelText('Title / Theme')).toBeRequired();
    expect(screen.getByLabelText('Schedule starts')).toHaveValue(cohort.startsOn);
    expect(screen.getByLabelText('Ends on')).toHaveValue(cohort.endsOn);
  });

  it('renders selectable-cohort and frequency-specific fields', async () => {
    render(
      <GenerateSessionsModal
        cohort={null}
        cohorts={[cohort]}
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cohort' })).toHaveTextContent(
      'Soft Skills · Summer 2026',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Frequency' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Monthly' }));
    expect(screen.getByRole('button', { name: 'Day of month' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Day of week' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Frequency' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'One time' }));
    expect(screen.getByLabelText('Session date')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ends on')).not.toBeInTheDocument();
  });

  it('disables the complete form while generation is pending', async () => {
    generateSessions.mockReturnValue(new Promise(() => undefined));
    render(<GenerateSessionsModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    fireEvent.change(screen.getByLabelText('Title / Theme'), {
      target: { value: 'Communication' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Sessions' }));

    const themeInput = screen.getByLabelText('Title / Theme');
    await waitFor(() => expect(themeInput.closest('form')).toHaveAttribute('aria-busy', 'true'));
    expect(themeInput).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Frequency' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Sessions' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
