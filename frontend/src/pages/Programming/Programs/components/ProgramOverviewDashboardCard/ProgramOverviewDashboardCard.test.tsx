import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycleAssignment } from '../../types';
import ProgramOverviewDashboardCard from './ProgramOverviewDashboardCard';
import { useProgramCycleAssignments } from '../../hooks/data/useProgramCycleAssignments';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';

vi.mock('../../hooks/data/useProgramCycleAssignments', () => ({ useProgramCycleAssignments: vi.fn() }));
vi.mock('../ManageRosterModal/ManageRosterModal', () => ({
  default: ({ assignment }: { assignment: ProgramCycleAssignment | null }) => assignment ? <div role="dialog" aria-label={`Roster for ${assignment.cycle}`} /> : null,
}));
vi.mock('../../../../../common/features/YouthReportModal/YouthReportModal', () => ({
  default: ({ programCycle }: { programCycle: ProgramCycleAssignment }) => <div role="dialog" aria-label={`Report for ${programCycle.cycle}`} />,
}));

const program: Program = {
  id: 'program-1', name: 'Art', description: 'Make art together.',
  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
  enrollmentRequired: true, minAge: null, maxAge: null,
};
const programCycle: ProgramCycleAssignment = {
  programId: program.id, program: program.name,
  enrollmentRequired: true, minAge: null, maxAge: null,
  cycleId: 'cycle-1', cycle: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'active',
  enrolledCount: 12, nextSessionAt: null, nextSessionId: null,
  averageAttendance: 75, attendanceAttendedCount: 9,
  attendanceRecordedCount: 12, uniqueAttendeeCount: 10,
};
const openProgramCycle: ProgramCycleAssignment = {
  ...programCycle, cycleId: 'cycle-2', cycle: 'Winter',
  enrollmentRequired: false, startsOn: '2027-01-01', endsOn: '2027-04-01', state: 'upcoming', averageAttendance: null,
};
/** Supplies the selected program context and permissions. @example makeProps().program.name // Art */
const makeProps = () => ({
  program, canManageRoster: true, canViewYouthReport: true,
});

describe('ProgramOverviewDashboardCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T16:00:00Z'));
    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [programCycle, openProgramCycle], loading: false, error: '', refresh: vi.fn() });
  });
  afterEach(() => vi.useRealTimers());

  it('shows selection, loading, and filtered empty states without current-cycle actions', () => {
    const props = makeProps();
    const { rerender } = render(<ProgramOverviewDashboardCard {...props} program={null} />);

    expect(screen.getByRole('heading', { name: 'Program Overview' })).toBeInTheDocument();
    expect(screen.getByText('Select a program to view its current cycle.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();

    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [], loading: true, error: '', refresh: vi.fn() });
    rerender(<ProgramOverviewDashboardCard {...props} />);
    expect(screen.getByRole('status', { name: 'Loading program rosters…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();

    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [], loading: false, error: '', refresh: vi.fn() });
    rerender(<ProgramOverviewDashboardCard {...props} />);
    expect(screen.getByRole('heading', { name: `${program.name} Overview` })).toBeInTheDocument();
    expect(screen.queryByText(program.description!)).not.toBeInTheDocument();
    expect(screen.getByText('No current cycle for this program.')).toBeInTheDocument();
  });

  it('preserves a failed program-cycle load as unavailable and offers recovery', () => {
    const props = makeProps();
    const onRetry = vi.fn();
    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [], loading: false, error: 'Request failed', refresh: onRetry });
    render(<ProgramOverviewDashboardCard {...props} />);

    expect(screen.getByText('Program rosters unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No current cycle for this program.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows only the current cycle and delegates its actions', () => {
    const props = makeProps();
    render(<ProgramOverviewDashboardCard {...props} />);

    expect(screen.getByRole('heading', { name: 'Art - Fall Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Art - Winter Overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    const enrolled = within(screen.getByRole('region', { name: 'Fall' }));
    expect(enrolled.queryByText('active')).not.toBeInTheDocument();
    expect(enrolled.getByText('Enrollment').nextElementSibling).toHaveTextContent('12');
    expect(enrolled.getByText('Average attendance').nextElementSibling).toHaveTextContent('75%');

    const header = screen.getByRole('heading', { name: 'Art - Fall Overview' }).parentElement!;
    fireEvent.click(within(header).getByRole('button', { name: 'Manage Roster' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Attendance Report' }));
    expect(screen.getByRole('dialog', { name: 'Roster for Fall' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Report for Fall' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Edit ProgramCycle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete ProgramCycle' })).not.toBeInTheDocument();
  });

  it('shows an empty state when only past and upcoming programCycles exist', () => {
    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [
      { ...programCycle, startsOn: '2026-01-01', endsOn: '2026-06-30', state: 'completed' }, openProgramCycle,
    ], loading: false, error: '', refresh: vi.fn() });
    render(<ProgramOverviewDashboardCard {...makeProps()} />);
    expect(screen.getByText('No current cycle for this program.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
  });

  it('uses the program timezone and includes the final cycle date', () => {
    vi.setSystemTime(new Date('2026-12-02T02:00:00Z'));
    render(<ProgramOverviewDashboardCard {...makeProps()} />);
    expect(screen.getByRole('heading', { name: 'Art - Fall Overview' })).toBeInTheDocument();
  });

  it('keeps the current drop-in report disabled', () => {
    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [
      { ...openProgramCycle, startsOn: programCycle.startsOn, endsOn: programCycle.endsOn, state: 'active' },
    ], loading: false, error: '', refresh: vi.fn() });
    render(<ProgramOverviewDashboardCard {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Manage Roster' })).not.toBeInTheDocument();
  });

  it('applies report and write permissions independently', () => {
    const props = makeProps();
    const { rerender } = render(<ProgramOverviewDashboardCard {...props} canManageRoster={false} />);

    expect(screen.queryByRole('button', { name: 'Manage Roster' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit ProgramCycle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete ProgramCycle' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeInTheDocument();

    rerender(<ProgramOverviewDashboardCard {...props} canViewYouthReport={false} />);
    expect(screen.queryByRole('button', { name: 'Attendance Report' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeInTheDocument();
  });

  it('preserves the shell and metric labels while loading a different program', () => {
    const props = makeProps();
    const view = render(<ProgramOverviewDashboardCard {...props} />);

    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [], loading: true, error: '', refresh: vi.fn() });
    view.rerender(<ProgramOverviewDashboardCard {...props} program={{ ...program, id: 'program-2', name: 'Music' }} />);

    expect(screen.getByText('Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Average attendance')).toBeInTheDocument();
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();
  });

  it('keeps metrics and disabled actions when a pending program load fails', () => {
    const props = makeProps();
    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [], loading: true, error: '', refresh: vi.fn() });
    const view = render(<ProgramOverviewDashboardCard {...props} />);

    vi.mocked(useProgramCycleAssignments).mockReturnValue({ assignments: [], loading: false, error: 'Unavailable', refresh: vi.fn() });
    view.rerender(<ProgramOverviewDashboardCard {...props} />);

    expect(screen.getByText('Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Average attendance')).toBeInTheDocument();
    expect(screen.getByText('Program rosters unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
  });
});
