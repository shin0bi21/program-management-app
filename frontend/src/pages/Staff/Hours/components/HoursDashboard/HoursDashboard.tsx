import { useMemo } from 'react';
import type { StaffResource } from '../../types';
import type { ProgramCycle } from '../../../../Programming/Cohorts/types';
import { formatShortDateRange } from '../../../../../common/utils/date';
import HoursDashboardCard from './HoursDashboardCard/HoursDashboardCard';
import useHoursOverviewData from './hooks/useHoursOverviewData';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';

interface HoursDashboardProps {
  queryKey: readonly unknown[];
  staff: StaffResource | null;
  cycle: ProgramCycle | null;
  onErrorChange?: PageErrorChangeHandler;
}

export default function HoursDashboard({
  queryKey,
  staff,
  cycle,
  onErrorChange,
}: HoursDashboardProps) {
  const overviewData = useHoursOverviewData(
    queryKey,
    staff?.id ?? null,
    cycle?.id ?? null,
  );
  const retry = overviewData.status === 'error' ? overviewData.retry : undefined;
  const retryAction = useMemo(
    () => retry ? { label: 'Retry', onClick: retry } : undefined,
    [retry],
  );
  usePageErrorReporter(
    onErrorChange,
    overviewData.status === 'error' ? overviewData.message : null,
    retryAction,
  );
  const unavailableMessage = staff && cycle
    ? 'Hours overview is unavailable.'
    : 'Select a staff member to view their hours overview.';
  const stateMessage = overviewData.status === 'loading'
    ? 'Loading hours overview…'
    : unavailableMessage;

  if (overviewData.status === 'error') {
    return <>
      <HoursDashboardCard
        title="Hours This Pay Period"
        emptyMessage=""
        unavailable={{ title: 'Hours overview unavailable', onRetry: overviewData.retry }}
      />
      <HoursDashboardCard
        title={`Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}`}
        emptyMessage=""
        unavailable={{ title: 'Hours overview unavailable', onRetry: overviewData.retry }}
      />
    </>;
  }

  if (overviewData.status !== 'ready') {
    const showTitles = Boolean(staff);
    return <>
      <HoursDashboardCard title={showTitles ? 'Hours This Pay Period' : undefined} emptyMessage={stateMessage} />
      <HoursDashboardCard
        title={showTitles ? `Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}` : undefined}
        emptyMessage={stateMessage}
      />
    </>;
  }

  const { payPeriod, biweeklyAverage } = overviewData.data;
  const payPeriodLabel = formatShortDateRange(payPeriod.periodStart, payPeriod.periodEnd);
  return <>
    <HoursDashboardCard
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
    <HoursDashboardCard
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
