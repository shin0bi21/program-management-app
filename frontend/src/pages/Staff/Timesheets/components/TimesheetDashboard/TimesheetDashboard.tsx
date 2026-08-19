import type { StaffResource } from '../../../../../common/features/timeEntries/types';
import type { ProgramCycle } from '../../../../../common/types/cohort';
import { formatShortDateRange } from '../../../../../common/utils/date';
import TimesheetDashboardCard from './TimesheetDashboardCard/TimesheetDashboardCard';
import useTimesheetOverviewData from './hooks/useTimesheetOverviewData';

interface TimesheetDashboardProps {
  queryKey: readonly unknown[];
  staff: StaffResource | null;
  cycle: ProgramCycle | null;
}

export default function TimesheetDashboard({
  queryKey,
  staff,
  cycle,
}: TimesheetDashboardProps) {
  const overviewData = useTimesheetOverviewData(
    queryKey,
    staff?.id ?? null,
    cycle?.id ?? null,
  );
  const unavailableMessage = staff && cycle
    ? 'Hours overview is unavailable.'
    : 'Select a staff member to view their hours overview.';
  const stateMessage = overviewData.status === 'loading'
    ? 'Loading hours overview…'
    : overviewData.status === 'error' ? overviewData.message : unavailableMessage;

  if (overviewData.status !== 'ready') {
    const showTitles = Boolean(staff);
    return <>
      <TimesheetDashboardCard title={showTitles ? 'Hours This Pay Period' : undefined} emptyMessage={stateMessage} />
      <TimesheetDashboardCard
        title={showTitles ? `Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}` : undefined}
        emptyMessage={stateMessage}
      />
    </>;
  }

  const { payPeriod, biweeklyAverage } = overviewData.data;
  const payPeriodLabel = formatShortDateRange(payPeriod.periodStart, payPeriod.periodEnd);
  return <>
    <TimesheetDashboardCard
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
    <TimesheetDashboardCard
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
