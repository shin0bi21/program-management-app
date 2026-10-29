import { useMemo } from 'react';
import type { StaffResource } from '../../types';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
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
  const data = overviewData.status === 'ready' ? overviewData.data : null;
  const payPeriod = data?.payPeriod;
  const biweeklyAverage = data?.biweeklyAverage;
  const payPeriodLabel = payPeriod
    ? formatShortDateRange(payPeriod.periodStart, payPeriod.periodEnd)
    : null;
  const sharedProps = {
    loading: overviewData.status === 'loading',
    scopeKey: JSON.stringify([staff?.id, cycle?.id]),
    emptyMessage: unavailableMessage,
    unavailable: overviewData.status === 'error'
      ? { title: 'Hours overview unavailable', onRetry: overviewData.retry }
      : undefined,
  };
  const payPeriodProps = payPeriod ? {
    total: payPeriod.totalHours,
    modalTitle: staff?.name ?? '',
    modalSubtitle: payPeriodLabel ?? '',
    breakdown: payPeriod.breakdown.map(item => [item.label, item.hours] as [string, number]),
  } : {};
  const averageProps = biweeklyAverage ? {
    total: biweeklyAverage.averageHours,
    modalTitle: staff?.name ?? '',
    modalSubtitle: `${cycle?.name ?? ''} · Biweekly Average`,
    breakdown: biweeklyAverage.breakdown.map(item => [item.label, item.hours] as [string, number]),
  } : {};

  return <>
    <HoursDashboardCard
      {...sharedProps}
      {...payPeriodProps}
      title="Hours This Pay Period"
      details={[
        ['Current Pay Period', payPeriodLabel],
        ['Hours', payPeriod?.totalHours.toFixed(2) ?? null],
      ]}
    />
    <HoursDashboardCard
      {...sharedProps}
      {...averageProps}
      title={`Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}`}
      details={[
        ['Cycle', cycle?.name ?? null],
        ['Biweekly Average', biweeklyAverage?.averageHours.toFixed(2) ?? null],
      ]}
    />
  </>;
}
