import type { ReactElement, ReactNode } from 'react';

import type { StaffReference } from '../../../../../../common/features/referenceData/referenceData.api';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import usePageMessageReporter from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import { getErrorMessage } from '../../../../../../http/errors';
import HoursBreakdown from '../HoursBreakdown/HoursBreakdown';
import useHoursCycleSummaryData from './hooks/useHoursCycleSummaryData';

interface HoursCycleSummaryDashboardCardProps {
  queryKey: readonly unknown[];
  staff: StaffReference | null;
  cycles: readonly ProgramCycle[];
}

/**
 * Loads and displays the selected staff member's cycle average, independent of the pay-period query.
 * Uses the first active cycle from shared references; entry placement and collection
 * filters do not change the reporting cycle. Without an active cycle, no summary is loaded.
 * @param props - Shared staff, ordered cycle references, and query namespace.
 * @example <HoursCycleSummaryDashboardCard queryKey={['hours']} staff={staff} cycles={cycles} />
 */
export default function HoursCycleSummaryDashboardCard({
  queryKey,
  staff,
  cycles,
}: HoursCycleSummaryDashboardCardProps): ReactElement {
  const cycle = cycles.find(candidate => candidate.state === 'active') ?? null;

  const staffId = staff?.id ?? null;
  const cycleId = cycle?.id ?? null;
  const hasScope = Boolean(staffId && cycleId);
  const query = useHoursCycleSummaryData(queryKey, staffId, cycleId);
  const queryError = hasScope ? query.error : null;
  const error = queryError ? getErrorMessage(queryError, 'Could not load cycle hours.') : null;
  usePageMessageReporter(undefined, error, queryError ? { label: 'Retry', onClick: query.refetch } : undefined);

  const summary = hasScope && !queryError ? query.data : undefined;
  const loading = hasScope && !queryError && !summary;
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
  if (queryError) {
    content = <UnavailableState
      compact
      title="Cycle hours unavailable"
      onRetry={query.refetch}
    />;
  } else if (!hasScope) {
    content = <p className="dashboard-card__empty">{emptyMessage}</p>;
  }

  return <DashboardCard
    title={`Average Biweekly Hours${cycle ? ` - ${cycle.title}` : ''}`}
    loading={loading}
    className="dashboard-card--short"
    details={[
      { label: 'Cycle', value: cycle?.title },
      { label: 'Biweekly Average', value: summary?.averageHours.toFixed(2) },
    ]}
    action={<HoursBreakdown
      data={breakdownData}
      scopeKey={JSON.stringify([staff?.id, cycle?.id])}
    />}
  >
    {content}
  </DashboardCard>;
}
