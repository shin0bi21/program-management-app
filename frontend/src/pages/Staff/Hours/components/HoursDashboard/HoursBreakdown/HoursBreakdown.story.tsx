import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import HoursBreakdown from './HoursBreakdown';

/**
 * Shows the standard Hours card with its independently owned breakdown action.
 * @param props.loading - Replaces the standard card's data with its loading state.
 * @example <HoursSummary loading /> // title and disabled breakdown action stay visible
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
      action={<HoursBreakdown data={data} scopeKey="staff-1:2026-10-01" disabled={loading} />}
    >
      <span className="dashboard-card__metric">12.00</span>
      <p>Oct 1–14</p>
    </DashboardCard>
  </div>;
}
