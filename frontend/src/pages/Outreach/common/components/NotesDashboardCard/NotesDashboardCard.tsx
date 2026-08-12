import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';

export default function NotesDashboardCard({ notes, selected }: { notes?: string | null; selected: boolean }) {
  return (
    <DashboardCard title="Notes">
      <p className={!selected || !notes?.trim() ? 'dashboard-card__empty' : undefined}>
        {!selected ? 'Select a row to view notes.' : notes?.trim() || 'No notes recorded.'}
      </p>
    </DashboardCard>
  );
}
