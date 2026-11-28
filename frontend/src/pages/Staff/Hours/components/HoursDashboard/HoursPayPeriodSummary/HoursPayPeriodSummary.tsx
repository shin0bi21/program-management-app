import type { ReactElement, ReactNode } from 'react';

import type { StaffReference } from '../../../../../../common/features/referenceData/referenceData.api';
import usePageMessageReporter from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { formatShortDateRange } from '../../../../../../common/utils/date';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import { getErrorMessage } from '../../../../../../http/errors';
import HoursBreakdownCard from '../HoursBreakdownCard/HoursBreakdownCard';
import useHoursPayPeriodData from './hooks/useHoursPayPeriodData';

interface HoursPayPeriodSummaryProps {
  queryKey: readonly unknown[];
  staff: StaffReference | null;
}

/**
 * Loads and displays the selected staff member's current pay period, independent of cycle selection.
 * @param props - Staff selection and query namespace.
 * @example <HoursPayPeriodSummary queryKey={['hours']} staff={staff} />
 */
export default function HoursPayPeriodSummary({
  queryKey,
  staff,
}: HoursPayPeriodSummaryProps): ReactElement {
  const staffId = staff?.id ?? null;
  const query = useHoursPayPeriodData(queryKey, staffId);
  const queryError = staffId ? query.error : null;
  const error = queryError ? getErrorMessage(queryError, 'Could not load pay-period hours.') : null;
  usePageMessageReporter(undefined, error, queryError ? { label: 'Retry', onClick: query.refetch } : undefined);

  const payPeriod = staffId && !queryError ? query.data : undefined;
  const loading = Boolean(staffId && !queryError && !payPeriod);
  const payPeriodLabel = payPeriod ? formatShortDateRange(payPeriod.periodStart, payPeriod.periodEnd) : null;
  const breakdownData = payPeriod ? {
    total: payPeriod.totalHours,
    title: staff?.name ?? '',
    subtitle: payPeriodLabel ?? '',
    breakdown: payPeriod.breakdown,
  } : null;

  let content: ReactNode;
  if (queryError) {
    content = <UnavailableState compact title="Pay-period hours unavailable" onRetry={query.refetch} />;
  } else if (!staffId) {
    content = <p className="dashboard-card__empty">Select a staff member to view their pay-period hours.</p>;
  }

  return <DashboardCard
    title="Hours This Pay Period"
    loading={loading}
    className="dashboard-card--short"
    details={[
      { label: 'Current Pay Period', value: payPeriodLabel },
      { label: 'Hours', value: payPeriod?.totalHours.toFixed(2) },
    ]}
    action={<HoursBreakdownCard
      data={breakdownData}
      scopeKey={JSON.stringify([staff?.id, payPeriod?.periodStart])}
    />}
  >
    {content}
  </DashboardCard>;
}
