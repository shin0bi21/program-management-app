// Owns AddCohortModal rendered behavior and owner wiring.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCohort } from '../../../../../common/features/programming/api/cohorts.api';
import AddCohortModal from './AddCohortModal';

vi.mock('../../../../../common/features/programming/api/cohorts.api', () => ({
  createCohort: vi.fn(),
}));

const programs = [
  { id: 'program-1', name: 'Soft Skills', description: null, rosterMode: 'enrolled' as const, minAge: 12, maxAge: 15 },
  { id: 'program-2', name: 'Job Readiness', description: null, rosterMode: 'enrolled' as const, minAge: 16, maxAge: 19 },
];
const cycles = [
  { id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-08-31', state: 'active' as const },
  { id: 'cycle-2', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-11-30', state: 'upcoming' as const },
];

describe('AddCohortModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the selected program and cycle then waits for the owner refresh', async () => {
    vi.mocked(createCohort).mockResolvedValue({
      id: 'cohort-1', programId: 'program-2', programName: 'Job Readiness', rosterMode: 'enrolled',
      cycleId: 'cycle-2', cycleName: 'Fall 2026', name: 'Fall 2026', startsOn: '2026-09-01',
      endsOn: '2026-11-30', state: 'upcoming', minAge: 16, maxAge: 19, enrolledCount: 0,
      nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
      attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
    });
    const onCreated = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AddCohortModal
        isOpen
        programs={programs}
        cycles={cycles}
        initialProgramId="program-2"
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Job Readiness'));
    expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Summer 2026');
    await user.click(screen.getByRole('button', { name: 'Cycle' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Fall 2026' }));
    fireEvent.submit(document.getElementById('add-cohort-form')!);

    await waitFor(() => expect(createCohort).toHaveBeenCalledWith({
      programId: 'program-2',
      cycleId: 'cycle-2',
    }));
    expect(onCreated).toHaveBeenCalledOnce();
    expect(screen.getByText('Job Readiness successfully added to Fall 2026.')).toBeInTheDocument();
  });

  it('keeps the modal open and reports create failures', async () => {
    vi.mocked(createCohort).mockRejectedValue(new Error('Cohort already exists'));
    render(
      <AddCohortModal
        isOpen
        programs={programs}
        cycles={cycles}
        initialProgramId="program-1"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Soft Skills'));
    fireEvent.submit(document.getElementById('add-cohort-form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cohort already exists');
    expect(screen.getByRole('dialog', { name: 'Add Cohort' })).toBeInTheDocument();
  });

  it('resets its selections and status each time it opens', async () => {
    vi.mocked(createCohort).mockRejectedValue(new Error('Cohort already exists'));
    const props = {
      programs,
      cycles,
      initialProgramId: 'program-1',
      onClose: vi.fn(),
      onCreated: vi.fn(),
    };
    const { rerender } = render(<AddCohortModal isOpen {...props} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Soft Skills'));
    fireEvent.submit(document.getElementById('add-cohort-form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cohort already exists');

    rerender(<AddCohortModal isOpen={false} {...props} />);
    rerender(<AddCohortModal isOpen {...props} initialProgramId="program-2" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Job Readiness'));
    expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Summer 2026');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
