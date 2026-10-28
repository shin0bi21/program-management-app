import { screen, waitFor } from '@testing-library/react';
import { renderWithQueryClient as render } from '../../../tests/queryClientTestUtils';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramReference } from '../../../common/features/referenceData/referenceData.api';
import Cohorts from './Cohorts';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
import type { CohortPreference } from './hooks/useCohortControls';

const api = vi.hoisted(() => ({
  createCohort: vi.fn(),
  deleteCohort: vi.fn(),
  getCohorts: vi.fn(),
  getCycleReferences: vi.fn(),
}));
const auth = vi.hoisted<{ role: string; permissions: string[] }>(() => ({
  role: 'admin',
  permissions: ['read:programs', 'write:programs', 'write:enrollments', 'read:youth_profiles', 'read:attendance', 'read:sessions'],
}));
const programState = vi.hoisted<{ programs: ProgramReference[] }>(() => ({
  programs: [{ id: 'program-1', name: 'Soft Skills' }],
}));
const preferenceApi = vi.hoisted(() => ({
  value: null as CohortPreference | null,
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock('./cohorts.api', () => ({
  getCohorts: api.getCohorts,
  getCohortPage: api.getCohorts,
  createCohort: api.createCohort,
  deleteCohort: api.deleteCohort,
}));
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: api.getCycleReferences,
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => auth,
}));
vi.mock('../../../common/features/Preferences/preferences.api', () => ({
  getPreference: preferenceApi.getPreference,
  setPreference: preferenceApi.setPreference,
}));
vi.mock('../../../common/features/YouthReportModal/YouthReportModal', () => ({
  default: ({ cohort }: { cohort: { name: string } | null }) => cohort
    ? <div role="dialog" aria-label={`${cohort.name} Youth Report`} />
    : null,
}));

vi.mock('../../../common/features/referenceData/hooks/useReferenceData', async importOriginal => ({
  ...await importOriginal<typeof import('../../../common/features/referenceData/hooks/useReferenceData')>(),
  useProgramReferences: () => ({
    rows: programState.programs,
    loading: false,
    error: null,
  }),
}));

describe('Cohorts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceApi.value = null;
    preferenceApi.getPreference.mockImplementation(async () => preferenceApi.value);
    preferenceApi.setPreference.mockImplementation(async (_key: string, value: CohortPreference) => {
      preferenceApi.value = value;
      return value;
    });
    auth.role = 'admin';
    auth.permissions = ['read:programs', 'write:programs', 'write:enrollments', 'read:youth_profiles', 'read:attendance', 'read:sessions'];
    programState.programs = [{ id: 'program-1', name: 'Soft Skills' }];
    api.getCycleReferences.mockResolvedValue([{
      id: 'cycle-summer-2026', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }]);
    api.getCohorts.mockResolvedValue([{
      id: 'cohort-1',
      programId: 'program-1',
      programName: 'Soft Skills',
      enrollmentRequired: true,
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
      enrollmentRequired: true,
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

  // Permissions and application services.
  it('keeps assignment creation out of staff access', () => {
    auth.role = 'staff';
    auth.permissions = ['read:programs', 'write:enrollments'];
    render(
      <MemoryRouter initialEntries={['/programming/cohorts']} future={routerFuture}>
        <Cohorts />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: '+ Add Cohort' })).not.toBeInTheDocument();
  });

  it.each([
    [['read:programs', 'write:enrollments', 'read:youth_profiles'], true],
    [['read:programs', 'write:programs', 'read:youth_profiles'], false],
    [['read:programs', 'write:enrollments'], false],
  ] as const)('gates roster management by enrollment and youth access: %j', async (permissions, expected) => {
    auth.permissions = [...permissions];
    const user = userEvent.setup();
    render(<MemoryRouter future={routerFuture}><Cohorts /></MemoryRouter>);

    await user.click((await screen.findByText('Summer 2026')).closest('tr')!);
    expect(Boolean(screen.queryByRole('button', { name: 'Manage Roster' }))).toBe(expected);
  });

  // Saved preferences and the current view.
  it('keeps persisted controls and content unavailable until restoration completes', async () => {
    let finishLoading!: (value: CohortPreference | null) => void;
    preferenceApi.getPreference.mockImplementationOnce(() => new Promise(resolve => { finishLoading = resolve; }));
    const rendered = render(<MemoryRouter future={routerFuture}><Cohorts /></MemoryRouter>);

    expect(screen.getByRole('status')).toHaveTextContent('Loading saved cohort preferences…');
    expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Cohorts' })).not.toBeInTheDocument();

    finishLoading(preferenceApi.value);
    rendered.rerender(<MemoryRouter future={routerFuture}><Cohorts /></MemoryRouter>);

    expect(await screen.findByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cohorts' })).toBeInTheDocument();
  });

  // Selection and page-spanning actions.
  it('shows all cohorts by default and can display a selected program', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming/cohorts']} future={routerFuture}>
        <Cohorts />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Cohorts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add Cohort' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search cohorts' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Filters' })).toBeInTheDocument();
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
    expect(firstOverviewCard!.compareDocumentPosition(cohortTable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const cohortRow = screen.getByText('Summer 2026').closest('tr');
    expect(cohortRow).toHaveAttribute('tabindex', '0');
    await user.click(cohortRow!);
    expect(cohortRow).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveTextContent('Enrollment:5');
    expect(overview).toHaveTextContent('80%');
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeEnabled();
    expect(screen.getAllByText('5')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Attendance Report' }));
    expect(screen.getByRole('dialog', { name: 'Summer 2026 Youth Report' })).toBeInTheDocument();

  });

  it('removes a deleted cohort without refetching the table', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming/cohorts']} future={routerFuture}>
        <Cohorts />
      </MemoryRouter>,
    );
    await screen.findByText('Summer 2026');
    const initialRequestCount = api.getCohorts.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'More actions for Summer 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Cohort' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteCohort).toHaveBeenCalledWith('cohort-1'));
    await waitFor(() => expect(screen.queryByText('Summer 2026')).not.toBeInTheDocument());
    expect(api.getCohorts).toHaveBeenCalledTimes(initialRequestCount);
    expect(screen.queryByRole('status', { name: 'Updating rows' })).not.toBeInTheDocument();
  });

  // Derived errors and presentation state.
  it('shows distinct youth attendance instead of enrollment for an open cohort', async () => {
    const user = userEvent.setup();
    api.getCohorts.mockResolvedValue([{
      id: 'drop-in-cohort',
      programId: 'drop-in',
      programName: 'Drop In',
      enrollmentRequired: false,
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
      <MemoryRouter initialEntries={['/programming/cohorts']} future={routerFuture}>
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
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).not.toHaveAttribute('title');
    await user.click(screen.getByRole('button', { name: 'More actions for Summer 2026' }));
    expect(screen.queryByRole('menuitem', { name: 'Manage Roster' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add Sessions' })).not.toBeInTheDocument();
  });

  // Render.
  it('shows success feedback after adding a cohort', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming/cohorts']} future={routerFuture}>
        <Cohorts />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '+ Add Cohort' }));
    await user.click(screen.getByRole('button', { name: 'Add Cohort' }));

    expect(await screen.findByText(
      'Soft Skills successfully added to Summer 2026.',
    )).toBeInTheDocument();
  });
});
