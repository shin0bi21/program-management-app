import { DashboardCard } from '../../../../common/components/DashboardCard/DashboardCard';

export default function IntakeInformationDashboardCard({ notes, selected }: { notes?: string | null; selected: boolean }) {
  return (
    <DashboardCard title="Intake Information">
      <p className={!selected || !notes?.trim() ? 'dashboard-card__empty' : undefined}>
        {!selected ? 'Select a lead to view intake information.' : notes?.trim() || 'No intake information recorded.'}
      </p>
    </DashboardCard>
  );
}
