import type { ReactNode } from 'react';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import useYouthProfileNotesData from './hooks/useYouthProfileNotesData';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import type { YouthProfileNote } from '../../../types';
import ProfileNoteRow from '../../ProfileNotes/ProfileNoteRow';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

interface YouthNotesDashboardCardProps {
  youthId: string | null;
  onSelectProfileNote: (note: YouthProfileNote) => void;
  canManageProfileNotes?: boolean;
  onAddProfileNote?: () => void;
  onEditProfileNote?: (note: YouthProfileNote) => void;
  onDeleteProfileNote?: (note: YouthProfileNote) => void;
  onMessageChange?: PageMessageChangeHandler;
}

/**
 * Loads and displays profile notes for the selected youth.
 * @param props.youthId - Selected youth ID; null displays the no-selection state.
 * @param props - Permission-gated note actions and the page message callback.
 * @example <YouthNotesDashboardCard youthId={selectedYouthId} onSelectProfileNote={openDetails} />
 */
export default function YouthNotesDashboardCard({
  youthId, onSelectProfileNote, canManageProfileNotes = false, onAddProfileNote, onEditProfileNote,
  onDeleteProfileNote, onMessageChange,
}: YouthNotesDashboardCardProps) {
  const { notes, loading, error, retry } = useYouthProfileNotesData(youthId);
  const selected = youthId !== null;
  usePageMessageReporter(onMessageChange, error, { label: 'Retry', onClick: retry });

  let content: ReactNode;
  if (!selected) content = <p className="dashboard-card__empty">Select a row to view notes.</p>;
  else if (error) content = <UnavailableState compact title="Profile notes unavailable" onRetry={retry} />;
  else if (!notes.length) content = <p className="dashboard-card__empty">No profile notes recorded.</p>;
  else content = <div className="note-list">{notes.map(note => (
    <ProfileNoteRow
      key={note.id}
      note={note}
      onView={onSelectProfileNote}
      onEdit={canManageProfileNotes ? onEditProfileNote : undefined}
      onDelete={canManageProfileNotes ? onDeleteProfileNote : undefined}
    />
  ))}</div>;

  return (
    <DashboardCard
      title="Notes"
      loading={selected && loading}
      loadingLabel="Loading profile notes…"
      action={canManageProfileNotes ? <Button size="sm" variant="secondary" aria-label="Add profile note" disabled={!selected} onClick={onAddProfileNote}>+ Add</Button> : undefined}
    >
      {content}
    </DashboardCard>
  );
}
