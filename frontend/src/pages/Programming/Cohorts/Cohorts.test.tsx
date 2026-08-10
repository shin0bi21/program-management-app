import { screen, waitFor } from '@testing-library/react';
import render from '../../../tests/renderWithQueryClient';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../common/features/programs/types';
import Cohorts from './Cohorts';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
}

const api = vi.hoisted(() => ({
  createCohort: vi.fn(),
  getCohorts: vi.fn(),
  getProgramCycles: vi.fn(),
  getSessionTypes: vi.fn(),
}));
const auth = vi.hoisted<{ role: string; permissions: string[] }>(() => ({
  role: 'admin',
  permissions: ['read:programs', 'write:programs', 'read:cohorts', 'write:cohorts', 'read:attendance', 'read:sessions'],
}));
const programState = vi.hoisted<{ programs: Program[] }>(() => ({
  programs: [{
    id: 'program-1',
    name: 'Soft Skills',
    description: 'Communication and practical life skills.',
    rosterMode: 'enrolled' as const,
    minAge: 12,
    maxAge: 15,
  }],
}));
const preferenceHook = vi.hoisted(() => ({
  preference: null as { programId: string | null; status: 'active' | 'upcoming' | 'completed' | null } | null,
  loading: false,
  error: null,
  save: vi.fn(),
}));

vi.mock('../../../common/features/programming/api/programming.api', () => ({
  getCohorts: api.getCohorts,
  getCohortPage: api.getCohorts,
  getSessionTypes: api.getSessionTypes,
  createCohort: api.createCohort,
  getProgramCycles: api.getProgramCycles,
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => auth,
}));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));
vi.mock('../../../common/features/programming/components/YouthReportModal/YouthReportModal', () => ({
  default: ({ cohort }: { cohort: { name: string } | null }) => cohort
    ? <div role="dialog" aria-label={`${cohort.name} Youth Report`} />
    : null,
}));

vi.mock('../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({
    programs: programState.programs,
    loading: false,
    error: null,
  }),
}));

describe('Cohorts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.save.mockReset();
    auth.role = 'admin';
    auth.permissions = ['read:programs', 'write:programs', 'read:cohorts', 'write:cohorts', 'read:attendance', 'read:sessions'];
    programState.programs = [{
      id: 'program-1',
      name: 'Soft Skills',
      description: 'Communication and practical life skills.',
      rosterMode: 'enrolled',
      minAge: 12,
      maxAge: 15,
    }];
    api.getSessionTypes.mockResolvedValue([
      { id: 'type-regular', name: 'Regular' },
    ]);
    api.getProgramCycles.mockResolvedValue([{
      id: 'cycle-summer-2026', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }]);
    api.getCohorts.mockResolvedValue([{
      id: 'cohort-1',
      programId: 'program-1',
      programName: 'Soft Skills',
      rosterMode: 'enrolled',
      cycleId: 'cycle-summer-2026',
      cycleName: 'Summer 2026',
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
    api.createCohort.mockResolvedValue({
      id: 'cohort-2',
      programId: 'program-1',
      programName: 'Soft Skills',
      rosterMode: 'enrolled',
      cycleId: 'cycle-fall-2026',
      cycleName: 'Fall 2026',
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
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <Cohorts />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Cohorts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add Cohort' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search cohorts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(await screen.findByText('Summer 2026')).toBeInTheDocument();
    expect(screen.getByText('No cohort selected.')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills')).toBeInTheDocument();
    expect(screen.queryAllByText('5')).toHaveLength(0);
    expect(screen.queryByRole('columnheader', { name: 'Youth' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Enrolled' })).not.toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    expect(headers.slice(2, 5)).toEqual(['Start', 'End', 'Status']);
    const cohortTable = screen.getByRole('table', { name: 'Cohorts' });
    const overview = screen.getByRole('region', { name: 'Programming cohorts and overview' });
    const firstOverviewCard = screen.getByRole('heading', { name: 'Youth Overview' }).closest('article');
    expect(firstOverviewCard).not.toBeNull();
    expect(cohortTable.compareDocumentPosition(firstOverviewCard!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const cohortRow = screen.getByText('Summer 2026').closest('tr');
    expect(cohortRow).toHaveAttribute('tabindex', '0');
    expect(cohortRow).toHaveClass('table-row--selectable');
    await user.click(cohortRow!);
    expect(cohortRow).toHaveClass('table-row--selected');
    expect(cohortRow).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveTextContent('Enrollment:5');
    expect(overview).toHaveTextContent('80%');
    expect(screen.getByRole('button', { name: 'View Report' })).toBeEnabled();
    expect(screen.getAllByText('5')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'View Report' }));
    expect(screen.getByRole('dialog', { name: 'Summer 2026 Youth Report' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions for Summer 2026' }));
    expect(screen.getByRole('menuitem', { name: 'Manage Roster' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit Cohort' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete Cohort' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Generate Sessions' })).not.toBeInTheDocument();

  });

  it('shows success feedback after adding a cohort', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <Cohorts />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '+ Add Cohort' }));
    await user.click(screen.getByRole('button', { name: 'Add Cohort' }));

    expect(api.createCohort).toHaveBeenCalledWith({
      programId: 'program-1',
      cycleId: 'cycle-summer-2026',
    });
    expect(await screen.findByText(
      'Soft Skills successfully added to Summer 2026.',
    )).toBeInTheDocument();
  });

  it('opens Add Cohort directly for staff without exposing global programming settings', async () => {
    auth.role = 'staff';
    auth.permissions = ['read:programs', 'read:cohorts', 'write:cohorts'];
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <Cohorts />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Add Program' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage Cycles' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add Cohort' }));
    expect(screen.getByRole('heading', { name: 'Add cohort' })).toBeInTheDocument();
  });

  it('defaults staff with one assigned program to that program and active cohorts', async () => {
    auth.role = 'staff';
    auth.permissions = ['read:programs', 'read:cohorts', 'write:cohorts'];
    programState.programs = [
      ...programState.programs,
      {
        id: 'drop-in',
        name: 'Drop In',
        description: null,
        rosterMode: 'open',
        minAge: null,
        maxAge: null,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <Cohorts />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/programming/cohorts');
    await waitFor(() => expect(api.getCohorts).toHaveBeenCalledWith(
      expect.objectContaining({ programId: 'program-1', status: 'active' }),
      expect.objectContaining({ key: 'start', direction: 'desc', limit: 25 }),
      { signal: expect.any(AbortSignal) },
    ));
  });

  it('does not default filters when staff has multiple assigned programs', async () => {
    auth.role = 'staff';
    auth.permissions = ['read:programs', 'read:cohorts', 'write:cohorts'];
    programState.programs = [
      ...programState.programs,
      {
        id: 'program-2',
        name: 'Job Readiness',
        description: null,
        rosterMode: 'enrolled',
        minAge: 16,
        maxAge: 19,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <Cohorts />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Summer 2026')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/programming/cohorts');
    expect(screen.getByTestId('location')).not.toHaveTextContent('?');
  });

  it('shows distinct youth attendance instead of enrollment for an open cohort', async () => {
    const user = userEvent.setup();
    api.getCohorts.mockResolvedValue([{
      id: 'drop-in-cohort',
      programId: 'drop-in',
      programName: 'Drop In',
      rosterMode: 'open',
      cycleId: 'cycle-summer-2026',
      cycleName: 'Summer 2026',
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
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <Cohorts />
      </MemoryRouter>,
    );

    const cohortRow = (await screen.findByText('Summer 2026')).closest('tr');
    await user.click(cohortRow!);
    const overview = screen.getByRole('region', { name: 'Programming cohorts and overview' });
    expect(overview).toHaveTextContent('Youth attended:8');
    expect(overview).not.toHaveTextContent('Youth enrolled');
    expect(overview).toHaveTextContent('Average attendance:100%');
    expect(overview).not.toHaveTextContent('Unique youth reached');
    expect(overview).not.toHaveTextContent('Total visits');
    expect(screen.getByRole('button', { name: 'View Report' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'View Report' })).toHaveAttribute(
      'title',
      'Drop In reporting is coming soon.',
    );
    await user.click(screen.getByRole('button', { name: 'More actions for Summer 2026' }));
    expect(screen.queryByRole('menuitem', { name: 'Manage Roster' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Sessions' })).toBeInTheDocument();
  });
});
