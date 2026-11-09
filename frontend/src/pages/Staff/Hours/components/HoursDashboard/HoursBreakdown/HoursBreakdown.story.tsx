import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import HoursBreakdown from './HoursBreakdown';

/**
 * Shows the standard Hours card with its independently owned breakdown action.
 * @param props.loading - Replaces summary values with loading indicators while labels stay visible.
 * @example <HoursSummary loading /> // labels and disabled breakdown action stay visible
 */
export function HoursSummary({ loading = false }: { loading?: boolean }) {
  const data = loading ? null : {
    total: 12,
    title: 'Zoe Wilson',
    subtitle: 'Oct 1–14',
    breakdown: [{ label: 'Meeting', hours: 12 }],
  };

  return <div style={{ width: 'min(100%, 360px)' }}>
    <DashboardCard
      title="Hours This Pay Period"
      loading={loading}
      className="dashboard-card--short"
      details={[
        { label: 'Current Pay Period', value: data?.subtitle },
        { label: 'Hours', value: data?.total.toFixed(2) },
      ]}
      action={<HoursBreakdown data={data} scopeKey="staff-1:2026-10-01" disabled={loading} />}
    />
  </div>;
}
