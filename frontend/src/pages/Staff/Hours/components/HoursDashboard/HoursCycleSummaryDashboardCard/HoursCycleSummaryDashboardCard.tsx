import type { ReactNode } from 'react';

import type { StaffReference } from '../../../types';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import usePageMessageReporter from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import HoursBreakdown from '../HoursBreakdown/HoursBreakdown';
import useHoursCycleSummaryData from './hooks/useHoursCycleSummaryData';

/**
 * Loads and displays the selected staff member's cycle average, independent of the pay-period query.
 * Uses the first active cycle from shared references; entry placement and collection
 * filters do not change the reporting cycle. Without an active cycle, no summary is loaded.
 * @param props - Shared staff, ordered cycle references, and query namespace.
 * @example <HoursCycleSummaryDashboardCard queryKey={['hours']} staff={staff} cycles={cycles} />
 */
export default function HoursCycleSummaryDashboardCard({ queryKey, staff, cycles }: {
  queryKey: readonly unknown[];
  staff: StaffReference | null;
  cycles: readonly ProgramCycle[];
}) {
  const cycle = cycles.find(candidate => candidate.state === 'active') ?? null;

  const state = useHoursCycleSummaryData(queryKey, staff?.id ?? null, cycle?.id ?? null);
  const error = state.status === 'error' ? state.message : null;
  const retry = state.status === 'error' ? state.retry : undefined;
  usePageMessageReporter(undefined, error, retry ? { label: 'Retry', onClick: retry } : undefined);

  const summary = state.status === 'ready' ? state.data : null;
  const breakdownData = summary ? {
    total: summary.averageHours,
    title: staff?.name ?? '',
    subtitle: `${cycle?.title ?? ''} · Biweekly Average`,
    breakdown: summary.breakdown,
  } : null;
  const emptyMessage = staff
    ? 'No current cycle is available.'
    : 'Select a staff member to view their cycle hours.';

  let content: ReactNode;
  if (state.status === 'error') {
    content = <UnavailableState
      compact
      title="Cycle hours unavailable"
      onRetry={state.retry}
    />;
  } else if (state.status === 'unavailable') {
    content = <p className="dashboard-card__empty">{emptyMessage}</p>;
  }

  return <DashboardCard
    title={`Average Biweekly Hours${cycle ? ` - ${cycle.title}` : ''}`}
    loading={state.status === 'loading'}
    className="dashboard-card--short"
    details={[
      { label: 'Cycle', value: cycle?.title },
      { label: 'Biweekly Average', value: summary?.averageHours.toFixed(2) },
    ]}
    action={<HoursBreakdown
      data={breakdownData}
      scopeKey={JSON.stringify([staff?.id, cycle?.id])}
      disabled={state.status !== 'ready'}
    />}
  >
    {content}
  </DashboardCard>;
}
