import { useEffect, useMemo } from 'react';

import type { StaffResource } from '../../../types';
import type { PageMessageItem } from '../../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import { formatShortDateRange } from '../../../../../../common/utils/date';
import HoursDashboardCard from '../HoursDashboardCard/HoursDashboardCard';
import useHoursPayPeriodData from './hooks/useHoursPayPeriodData';

/**
 * Loads and displays the selected staff member's current pay period, independent of cycle selection.
 * @param props - Staff selection, query namespace, and this card's error slot.
 * @example <HoursPayPeriodDashboardCard queryKey={['hours']} staff={staff} onErrorChange={report} />
 */
export default function HoursPayPeriodDashboardCard({ queryKey, staff, onErrorChange }: {
  queryKey: readonly unknown[];
  staff: StaffResource | null;
  onErrorChange: (message: PageMessageItem | null) => void;
}) {
  const state = useHoursPayPeriodData(queryKey, staff?.id ?? null);
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

  const payPeriod = state.status === 'ready' ? state.data : null;
  const payPeriodLabel = payPeriod ? formatShortDateRange(payPeriod.periodStart, payPeriod.periodEnd) : null;
  const readyProps = payPeriod ? {
    total: payPeriod.totalHours,
    modalTitle: staff?.name ?? '',
    modalSubtitle: payPeriodLabel ?? '',
    breakdown: payPeriod.breakdown.map(item => [item.label, item.hours] as [string, number]),
  } : {};

  return <HoursDashboardCard
    {...readyProps}
    title="Hours This Pay Period"
    loading={state.status === 'loading'}
    scopeKey={JSON.stringify([staff?.id, payPeriod?.periodStart])}
    emptyMessage="Select a staff member to view their pay-period hours."
    unavailable={state.status === 'error' ? { title: 'Pay-period hours unavailable', onRetry: state.retry } : undefined}
    details={[
      ['Current Pay Period', payPeriodLabel],
      ['Hours', payPeriod?.totalHours.toFixed(2) ?? null],
    ]}
  />;
}
