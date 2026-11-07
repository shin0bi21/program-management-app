import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycleAssignment } from '../../types';
import ProgramOverviewDashboardCard from './ProgramOverviewDashboardCard';

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
const makeProps = () => ({
  program, assignments: [programCycle, openProgramCycle], canManageRoster: true, canViewYouthReport: true,
  onManageRoster: vi.fn(), onViewReport: vi.fn(),
});

describe('ProgramOverviewDashboardCard', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T16:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('shows selection, loading, and filtered empty states without current-cycle actions', () => {
    const props = makeProps();
    const { rerender } = render(<ProgramOverviewDashboardCard {...props} program={null} />);

    expect(screen.getByRole('heading', { name: 'Program Overview' })).toBeInTheDocument();
    expect(screen.getByText('Select a program to view its current cycle.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();

    rerender(<ProgramOverviewDashboardCard {...props} loading />);
    expect(screen.getByRole('status', { name: 'Loading program rosters…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();

    rerender(<ProgramOverviewDashboardCard {...props} assignments={[]} />);
    expect(screen.getByRole('heading', { name: `${program.name} Overview` })).toBeInTheDocument();
    expect(screen.queryByText(program.description!)).not.toBeInTheDocument();
    expect(screen.getByText('No current cycle for this program.')).toBeInTheDocument();
  });

  it('preserves a failed program-cycle load as unavailable and offers recovery', () => {
    const props = makeProps();
    const onRetry = vi.fn();
    render(<ProgramOverviewDashboardCard {...props} assignments={[]} error="Request failed" onRetry={onRetry} />);

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
    expect(props.onManageRoster).toHaveBeenCalledWith(programCycle);
    expect(props.onViewReport).toHaveBeenCalledWith(programCycle);

    expect(screen.queryByRole('button', { name: 'Edit ProgramCycle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete ProgramCycle' })).not.toBeInTheDocument();
  });

  it('shows an empty state when only past and upcoming programCycles exist', () => {
    render(<ProgramOverviewDashboardCard {...makeProps()} assignments={[
      { ...programCycle, startsOn: '2026-01-01', endsOn: '2026-06-30', state: 'completed' }, openProgramCycle,
    ]} />);
    expect(screen.getByText('No current cycle for this program.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
  });

  it('uses the program timezone and includes the final cycle date', () => {
    vi.setSystemTime(new Date('2026-12-02T02:00:00Z'));
    render(<ProgramOverviewDashboardCard {...makeProps()} />);
    expect(screen.getByRole('heading', { name: 'Art - Fall Overview' })).toBeInTheDocument();
  });

  it('keeps the current drop-in report disabled', () => {
    render(<ProgramOverviewDashboardCard {...makeProps()} assignments={[
      { ...openProgramCycle, startsOn: programCycle.startsOn, endsOn: programCycle.endsOn, state: 'active' },
    ]} />);
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Manage Roster' })).not.toBeInTheDocument();
  });

  it('applies report and write permissions independently', () => {
    const props = makeProps();
    const { rerender } = render(<ProgramOverviewDashboardCard {...props} canManageRoster={false} />);

    expect(screen.queryByRole('button', { name: 'Manage Roster' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit ProgramCycle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete ProgramCycle' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Attendance Report' })).toHaveLength(1);

    rerender(<ProgramOverviewDashboardCard {...props} canViewYouthReport={false} />);
    expect(screen.queryByRole('button', { name: 'Attendance Report' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeInTheDocument();
  });
  it('preserves the shell and metric labels while loading a different program', () => {
    const props = makeProps();
    const view = render(<ProgramOverviewDashboardCard {...props} />);
    const card = screen.getByRole('heading', { name: 'Art - Fall Overview' }).closest('article');

    view.rerender(<ProgramOverviewDashboardCard {...props} program={{ ...program, id: 'program-2', name: 'Music' }} assignments={[]} loading />);

    expect(screen.getByRole('heading', { name: 'Music Overview' }).closest('article')).toBe(card);
    expect(screen.getByText('Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Average attendance')).toBeInTheDocument();
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();
  });

  it('keeps metrics and disabled actions when a pending program load fails', () => {
    const props = { ...makeProps(), assignments: [] };
    const view = render(<ProgramOverviewDashboardCard {...props} loading />);
    const heading = screen.getByRole('heading', { name: 'Art Overview' });
    const card = heading.closest('article');

    view.rerender(<ProgramOverviewDashboardCard {...props} error="Unavailable" />);

    expect(screen.getByRole('heading', { name: 'Art Overview' })).toBe(heading);
    expect(heading.closest('article')).toBe(card);
    expect(screen.getByText('Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Average attendance')).toBeInTheDocument();
    expect(screen.getByText('Program rosters unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
  });

});
