import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateCohort } from '../../cohorts.api';
import type { ProgramCohort } from '../../types';
import EditCohortModal from './EditCohortModal';

vi.mock('../../cohorts.api', () => ({
  updateCohort: vi.fn(),
}));

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', enrollmentRequired: true,
  cycleId: 'cycle-1', cycleName: 'Summer 2026', name: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-08-31', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};
const cycles = [
  { id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-08-31', state: 'active' as const },
  { id: 'cycle-2', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-11-30', state: 'upcoming' as const },
];

describe('EditCohortModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes from the cohort and saves the selected cycle', async () => {
    vi.mocked(updateCohort).mockResolvedValue(cohort);
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EditCohortModal cohort={cohort} cycles={cycles} onClose={vi.fn()} onUpdated={onUpdated} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Summer 2026'));
    await user.click(screen.getByRole('button', { name: 'Cycle' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Fall 2026' }));
    fireEvent.submit(document.getElementById('edit-cohort-form')!);

    await waitFor(() => expect(updateCohort).toHaveBeenCalledWith('cohort-1', { cycleId: 'cycle-2' }));
    expect(onUpdated).toHaveBeenCalledOnce();
    expect(screen.getByText('Cohort updated successfully.')).toBeInTheDocument();
  });

  it('keeps the modal open and reports update failures', async () => {
    vi.mocked(updateCohort).mockRejectedValue(new Error('Cycle is unavailable'));
    render(<EditCohortModal cohort={cohort} cycles={cycles} onClose={vi.fn()} onUpdated={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Summer 2026'));
    fireEvent.submit(document.getElementById('edit-cohort-form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle is unavailable');
    expect(screen.getByRole('dialog', { name: 'Edit Cohort' })).toBeInTheDocument();
  });

  it('resets the selected cycle and status when the target changes', async () => {
    vi.mocked(updateCohort).mockRejectedValue(new Error('Cycle is unavailable'));
    const props = { cycles, onClose: vi.fn(), onUpdated: vi.fn() };
    const { rerender } = render(<EditCohortModal cohort={cohort} {...props} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Summer 2026'));
    fireEvent.submit(document.getElementById('edit-cohort-form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle is unavailable');

    rerender(<EditCohortModal cohort={null} {...props} />);
    rerender(<EditCohortModal cohort={{ ...cohort, id: 'cohort-2', cycleId: 'cycle-2' }} {...props} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Fall 2026'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
