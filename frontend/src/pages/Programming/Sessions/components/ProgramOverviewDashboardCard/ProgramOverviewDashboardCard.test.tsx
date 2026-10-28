import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCohort } from '../../../Cohorts/types';
import ProgramOverviewDashboardCard from './ProgramOverviewDashboardCard';

const program: Program = {
  id: 'program-1', name: 'Art', description: 'Make art together.',

  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',

  rosterMode: 'enrolled', minAge: null, maxAge: null,
};
const cohort: ProgramCohort = {
  id: 'cohort-1', programId: program.id, programName: program.name,

  rosterMode: 'enrolled', minAge: null, maxAge: null,
  cycleId: 'cycle-1', cycleName: 'Fall', name: 'Weekly art',
  startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'active',
  enrolledCount: 12, nextSessionAt: null, nextSessionId: null,
  averageAttendance: 75, attendanceAttendedCount: 9,
  attendanceRecordedCount: 12, uniqueAttendeeCount: 10,
};
const openCohort: ProgramCohort = {
  ...cohort, id: 'cohort-2', cycleName: 'Winter', name: 'Drop In art',
  rosterMode: 'open', startsOn: '2027-01-01', endsOn: '2027-04-01', state: 'upcoming', averageAttendance: null,
};
const makeProps = () => ({
  program, cohorts: [cohort, openCohort], canManageRoster: true, canViewYouthReport: true,
  onManageRoster: vi.fn(), onViewReport: vi.fn(),
});

describe('ProgramOverviewDashboardCard', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T16:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('shows selection, loading, and filtered empty states without cohort actions', () => {
    const props = makeProps();
    const { rerender } = render(<ProgramOverviewDashboardCard {...props} program={null} />);

    expect(screen.getByRole('heading', { name: 'Program overview' })).toBeInTheDocument();
    expect(screen.getByText('Select a program to view its current cohort.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<ProgramOverviewDashboardCard {...props} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading program rosters…');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<ProgramOverviewDashboardCard {...props} cohorts={[]} />);
    expect(screen.getByRole('heading', { name: `${program.name} Overview` })).toBeInTheDocument();
    expect(screen.queryByText(program.description!)).not.toBeInTheDocument();
    expect(screen.getByText('No current cohort matches the selected filters.')).toBeInTheDocument();
  });

  it('preserves a failed cohort load as unavailable and offers recovery', () => {
    const props = makeProps();
    const onRetry = vi.fn();
    render(<ProgramOverviewDashboardCard {...props} cohorts={[]} error="Request failed" onRetry={onRetry} />);

    expect(screen.getByText('Program rosters unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No current cohort matches the selected filters.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows only the current cohort and delegates its actions', () => {
    const props = makeProps();
    render(<ProgramOverviewDashboardCard {...props} />);

    expect(screen.getByRole('heading', { name: 'Art - Fall Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Art - Winter Overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    const enrolled = within(screen.getByRole('region', { name: 'Fall: Weekly art' }));
    expect(enrolled.queryByText('active')).not.toBeInTheDocument();
    expect(enrolled.getByText('Enrollment').nextElementSibling).toHaveTextContent('12');
    expect(enrolled.getByText('Average attendance').nextElementSibling).toHaveTextContent('75%');

    const header = screen.getByRole('heading', { name: 'Art - Fall Overview' }).parentElement!;
    fireEvent.click(within(header).getByRole('button', { name: 'Manage Roster' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Attendance Report' }));
    expect(props.onManageRoster).toHaveBeenCalledWith(cohort);
    expect(props.onViewReport).toHaveBeenCalledWith(cohort);

    expect(screen.queryByRole('button', { name: 'Edit Cohort' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Cohort' })).not.toBeInTheDocument();
  });

  it('shows an empty state when only past and upcoming cohorts exist', () => {
    render(<ProgramOverviewDashboardCard {...makeProps()} cohorts={[
      { ...cohort, startsOn: '2026-01-01', endsOn: '2026-06-30', state: 'completed' }, openCohort,
    ]} />);
    expect(screen.getByText('No current cohort matches the selected filters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Attendance Report' })).not.toBeInTheDocument();
  });

  it('uses the program timezone and includes the final cycle date', () => {
    vi.setSystemTime(new Date('2026-12-02T02:00:00Z'));
    render(<ProgramOverviewDashboardCard {...makeProps()} />);
    expect(screen.getByRole('heading', { name: 'Art - Fall Overview' })).toBeInTheDocument();
  });

  it('keeps the current drop-in report disabled', () => {
    render(<ProgramOverviewDashboardCard {...makeProps()} cohorts={[
      { ...openCohort, startsOn: cohort.startsOn, endsOn: cohort.endsOn, state: 'active' },
    ]} />);
    expect(screen.getByRole('button', { name: 'Attendance Report' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Manage Roster' })).not.toBeInTheDocument();
  });

  it('applies report and write permissions independently', () => {
    const props = makeProps();
    const { rerender } = render(<ProgramOverviewDashboardCard {...props} canManageRoster={false} />);

    expect(screen.queryByRole('button', { name: 'Manage Roster' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Cohort' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Cohort' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Attendance Report' })).toHaveLength(1);

    rerender(<ProgramOverviewDashboardCard {...props} canViewYouthReport={false} />);
    expect(screen.queryByRole('button', { name: 'Attendance Report' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeInTheDocument();
  });
});
