import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Programming from './Programming';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
}

const api = vi.hoisted(() => ({
  createCohort: vi.fn(),
  createProgram: vi.fn(),
  getCohorts: vi.fn(),
}));

vi.mock('../../common/api/cohorts.api', () => ({
  getCohorts: api.getCohorts,
  createCohort: api.createCohort,
}));

vi.mock('../../common/api/programs.api', () => ({
  createProgram: api.createProgram,
}));

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:programs', 'write:programs', 'read:cohorts', 'write:cohorts'] }),
}));

vi.mock('../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({
    programs: [{
      id: 'program-1',
      name: 'Soft Skills',
      description: 'Communication and practical life skills.',
    }],
    setPrograms: vi.fn(),
    loading: false,
    error: null,
  }),
}));

describe('Programming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCohorts.mockResolvedValue([{
      id: 'cohort-1',
      programId: 'program-1',
      programName: 'Soft Skills',
      rosterMode: 'enrolled',
      name: 'Summer 2026',
      startsOn: '2026-07-01',
      endsOn: '2026-09-01',
      state: 'active',
      enrolledCount: 5,
      nextSessionAt: '2026-07-28T21:00:00.000Z',
      nextSessionId: 'session-1',
      averageAttendance: 80,
      attendanceAttendedCount: 4,
      attendanceRecordedCount: 5,
      uniqueAttendeeCount: 4,
    }]);
    api.createProgram.mockResolvedValue({
      id: 'program-2',
      name: 'Job Readiness',
      description: 'Employment preparation',
    });
    api.createCohort.mockResolvedValue({
      id: 'cohort-2',
      programId: 'program-1',
      programName: 'Soft Skills',
      rosterMode: 'enrolled',
      name: 'Fall 2026',
      startsOn: '2026-09-01',
      endsOn: '2026-11-30',
      state: 'upcoming',
      enrolledCount: 0,
      nextSessionAt: null,
      nextSessionId: null,
      averageAttendance: null,
      attendanceAttendedCount: 0,
      attendanceRecordedCount: 0,
      uniqueAttendeeCount: 0,
    });
  });

  it('shows all cohorts by default and can display a selected program', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming']}>
        <Programming />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Programming' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search cohorts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(await screen.findByText('Summer 2026')).toBeInTheDocument();
    expect(screen.getAllByText('No cohort selected.')).toHaveLength(3);
    expect(screen.getByText('Soft Skills')).toBeInTheDocument();
    expect(screen.getAllByText('5')).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Youth' })).toBeInTheDocument();
    const cohortRow = screen.getByText('Summer 2026').closest('tr');
    expect(cohortRow).toHaveAttribute('tabindex', '0');
    expect(cohortRow).toHaveClass('table-row--selectable');
    await user.click(cohortRow!);
    expect(cohortRow).toHaveClass('table-row--selected');
    expect(cohortRow).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Programming overview' })).toHaveTextContent('80%');
    expect(screen.getAllByText('5')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'More actions for Summer 2026' }));
    expect(screen.getByRole('menuitem', { name: 'Add Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit Cohort' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete Cohort' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Generate Sessions' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/programming/sessions?session=session-1');
  });

  it('shows success feedback after adding a program', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming']}>
        <Programming />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'Add Program' }));
    await user.type(screen.getByRole('textbox', { name: 'Program name' }), 'Job Readiness');
    await user.click(screen.getByRole('button', { name: 'Add Program' }));

    expect(api.createProgram).toHaveBeenCalledWith({
      name: 'Job Readiness',
      description: null,
      rosterMode: 'enrolled',
    });
    expect(await screen.findByText('Job Readiness successfully added.')).toBeInTheDocument();
  });

  it('shows success feedback after adding a cohort', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming']}>
        <Programming />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'Add Cohort' }));
    await user.type(screen.getByRole('textbox', { name: 'Cohort name' }), 'Fall 2026');
    await user.type(screen.getByLabelText('Starts on'), '2026-09-01');
    await user.type(screen.getByLabelText('Ends on'), '2026-11-30');
    await user.click(screen.getByRole('button', { name: 'Add Cohort' }));

    expect(api.createCohort).toHaveBeenCalledWith({
      programId: 'program-1',
      name: 'Fall 2026',
      startsOn: '2026-09-01',
      endsOn: '2026-11-30',
    });
    expect(await screen.findByText(
      'Fall 2026 successfully added to Soft Skills.',
    )).toBeInTheDocument();
  });

  it('shows reach metrics and no enrollment action for an open cohort', async () => {
    const user = userEvent.setup();
    api.getCohorts.mockResolvedValue([{
      id: 'drop-in-cohort',
      programId: 'drop-in',
      programName: 'Drop In',
      rosterMode: 'open',
      name: 'Summer 2026',
      startsOn: '2026-07-01',
      endsOn: '2026-09-01',
      state: 'active',
      enrolledCount: 0,
      nextSessionAt: null,
      nextSessionId: null,
      averageAttendance: 100,
      attendanceAttendedCount: 12,
      attendanceRecordedCount: 12,
      uniqueAttendeeCount: 8,
    }]);

    render(
      <MemoryRouter initialEntries={['/programming']}>
        <Programming />
      </MemoryRouter>,
    );

    const cohortRow = (await screen.findByText('Summer 2026')).closest('tr');
    await user.click(cohortRow!);
    expect(screen.getByRole('region', { name: 'Programming overview' })).toHaveTextContent('Unique youth reached8');
    expect(screen.getByRole('region', { name: 'Programming overview' })).toHaveTextContent('Total visits12');

    await user.click(screen.getByRole('button', { name: 'More actions for Summer 2026' }));
    expect(screen.queryByRole('menuitem', { name: 'Enroll Youth' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Sessions' })).toBeInTheDocument();
  });
});
