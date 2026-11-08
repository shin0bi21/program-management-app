import { useEffect, useMemo } from 'react';

import type { StaffResource } from '../../../types';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import type { PageMessageItem } from '../../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import HoursDashboardCard from '../HoursDashboardCard/HoursDashboardCard';
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
  const readyProps = summary ? {
    total: summary.averageHours,
    modalTitle: staff?.name ?? '',
    modalSubtitle: `${cycle?.name ?? ''} · Biweekly Average`,
    breakdown: summary.breakdown.map(item => [item.label, item.hours] as [string, number]),
  } : {};
  const emptyMessage = staff
    ? 'Select a cycle to view its hours average.'
    : 'Select a staff member to view their cycle hours.';

  return <HoursDashboardCard
    {...readyProps}
    title={`Average Biweekly Hours${cycle ? ` - ${cycle.name}` : ''}`}
    loading={state.status === 'loading'}
    scopeKey={JSON.stringify([staff?.id, cycle?.id])}
    emptyMessage={emptyMessage}
    unavailable={state.status === 'error' ? { title: 'Cycle hours unavailable', onRetry: state.retry } : undefined}
    details={[
      ['Cycle', cycle?.name ?? null],
      ['Biweekly Average', summary?.averageHours.toFixed(2) ?? null],
    ]}
  />;
}
