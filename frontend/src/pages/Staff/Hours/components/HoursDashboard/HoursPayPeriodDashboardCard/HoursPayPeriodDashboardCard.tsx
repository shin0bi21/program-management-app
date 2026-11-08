import { useEffect, useMemo, type ReactNode } from 'react';

import type { StaffResource } from '../../../types';
import type { PageMessageItem } from '../../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import { formatShortDateRange } from '../../../../../../common/utils/date';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import HoursBreakdown from '../HoursBreakdown/HoursBreakdown';
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
  const breakdownData = payPeriod ? {
    total: payPeriod.totalHours,
    title: staff?.name ?? '',
    subtitle: payPeriodLabel ?? '',
    breakdown: payPeriod.breakdown,
  } : null;

  let content: ReactNode;
  if (state.status === 'error') {
    content = <UnavailableState compact title="Pay-period hours unavailable" onRetry={state.retry} />;
  } else if (state.status === 'unavailable') {
    content = <p className="dashboard-card__empty">Select a staff member to view their pay-period hours.</p>;
  }

  return <DashboardCard
    title="Hours This Pay Period"
    loading={state.status === 'loading'}
    className="dashboard-card--short"
    details={[
      { label: 'Current Pay Period', value: payPeriodLabel },
      { label: 'Hours', value: payPeriod?.totalHours.toFixed(2) },
    ]}
    action={<HoursBreakdown
      data={breakdownData}
      scopeKey={JSON.stringify([staff?.id, payPeriod?.periodStart])}
      disabled={state.status !== 'ready'}
    />}
  >
    {content}
  </DashboardCard>;
}
