import type { StaffResource } from '../../../../../common/features/timeEntries/types';
import type { ProgramCycle } from '../../../../../common/types/cohort';
import { formatShortDateRange } from '../../../../../common/utils/date';
import TimesheetOverviewCard from '../TimesheetOverviewCard/TimesheetOverviewCard';
import type { TimesheetOverviewState } from '../../hooks/useTimesheetOverview';

interface TimesheetDashboardProps {
  staff: StaffResource | null;
  cycle: ProgramCycle | null;
  overview: TimesheetOverviewState;
}

export default function TimesheetDashboard({ staff, cycle, overview }: TimesheetDashboardProps) {
  const unavailableMessage = staff && cycle
    ? 'Hours overview is unavailable.'
    : 'Select a staff member to view their hours overview.';
  const stateMessage = overview.status === 'loading'
    ? 'Loading hours overview…'
    : overview.status === 'error' ? overview.message : unavailableMessage;

  if (overview.status !== 'ready') {
    const showTitles = Boolean(staff);
    return <>
      <TimesheetOverviewCard title={showTitles ? 'Hours This Pay Period' : undefined} emptyMessage={stateMessage} />
      <TimesheetOverviewCard
        title={showTitles ? `Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}` : undefined}
        emptyMessage={stateMessage}
      />
    </>;
  }

  const { payPeriod, biweeklyAverage } = overview.data;
  const payPeriodLabel = formatShortDateRange(payPeriod.periodStart, payPeriod.periodEnd);
  return <>
    <TimesheetOverviewCard
      title="Hours This Pay Period"
      total={payPeriod.totalHours}
      modalTitle={staff?.name ?? ''}
      modalSubtitle={payPeriodLabel}
      breakdown={payPeriod.breakdown.map(item => [item.label, item.hours])}
      emptyMessage={unavailableMessage}
      details={[
        ['Current Pay Period', payPeriodLabel],
        ['Hours', payPeriod.totalHours.toFixed(2)],
      ]}
    />
    <TimesheetOverviewCard
      title={`Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}`}
      total={biweeklyAverage.averageHours}
      modalTitle={staff?.name ?? ''}
      modalSubtitle={`${cycle?.name ?? ''} · Biweekly Average`}
      breakdown={biweeklyAverage.breakdown.map(item => [item.label, item.hours])}
      emptyMessage={unavailableMessage}
      details={[
        ['Cycle', cycle?.name ?? ''],
        ['Biweekly Average', biweeklyAverage.averageHours.toFixed(2)],
      ]}
    />
  </>;
}
