import HoursDashboardCard from './HoursDashboardCard';

export function HoursSummary({ loading = false }: { loading?: boolean }) {
  const details: Array<[string, string | null]> = [['Current Pay Period', loading ? null : 'Oct 1–14'], ['Hours', loading ? null : '12.00']];
  return <div style={{ width: 'min(100%, 360px)' }}>{loading
    ? <HoursDashboardCard title="Hours This Pay Period" emptyMessage="No staff selected." loading details={details} />
    : <HoursDashboardCard title="Hours This Pay Period" emptyMessage="No staff selected." details={details} total={12} modalTitle="Zoe Wilson" modalSubtitle="Oct 1–14" breakdown={[]} />}
  </div>;
}
