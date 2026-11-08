import { useEffect, useMemo, type ReactNode } from 'react';

import type { StaffResource } from '../../../types';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import type { PageMessageItem } from '../../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import HoursBreakdown from '../HoursBreakdown/HoursBreakdown';
import useHoursCycleSummaryData from './hooks/useHoursCycleSummaryData';

/**
 * Loads and displays the selected staff member's cycle average, independent of the pay-period query.
 * @param props - Staff/cycle selections, query namespace, and this card's error slot.
 * @example <HoursCycleSummaryDashboardCard queryKey={['hours']} staff={staff} cycle={cycle} onErrorChange={report} />
 */
export default function HoursCycleSummaryDashboardCard({ queryKey, staff, cycle, onErrorChange }: {
  queryKey: readonly unknown[];
  staff: StaffResource | null;
  cycle: ProgramCycle | null;
  onErrorChange: (message: PageMessageItem | null) => void;
}) {
  const state = useHoursCycleSummaryData(queryKey, staff?.id ?? null, cycle?.id ?? null);
  const error = state.status === 'error' ? state.message : null;
  const retry = state.status === 'error' ? state.retry : undefined;
  const message = useMemo(() => {
    if (!error || !retry) return null;

    return { message: error, action: { label: 'Retry', onClick: retry } };
  }, [error, retry]);

  useEffect(() => {
    onErrorChange(message);
    return () => onErrorChange(null);
  }, [message, onErrorChange]);

  const summary = state.status === 'ready' ? state.data : null;
  const breakdownData = summary ? {
    total: summary.averageHours,
    title: staff?.name ?? '',
    subtitle: `${cycle?.name ?? ''} · Biweekly Average`,
    breakdown: summary.breakdown,
  } : null;
  const emptyMessage = staff
    ? 'Select a cycle to view its hours average.'
    : 'Select a staff member to view their cycle hours.';

  let content: ReactNode;
  if (state.status === 'error') {
    content = <UnavailableState compact title="Cycle hours unavailable" onRetry={state.retry} />;
  } else if (summary) {
    content = <strong className="dashboard-card__metric">{summary.averageHours.toFixed(2)}</strong>;
  }

  return <DashboardCard
    title={`Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}`}
    loading={state.status === 'loading'}
    loadingLabel="Loading cycle hours…"
    emptyMessage={emptyMessage}
    action={<HoursBreakdown
      data={breakdownData}
      scopeKey={JSON.stringify([staff?.id, cycle?.id])}
      disabled={state.status !== 'ready'}
    />}
  >
    {content}
  </DashboardCard>;
}
