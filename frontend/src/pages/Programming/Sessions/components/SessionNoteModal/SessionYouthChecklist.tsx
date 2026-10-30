import type { CohortSession, SessionRosterMember } from '../../types';
import Checklist from '../../../../../common/components/Checklist/Checklist';

interface SessionYouthChecklistProps {
  enrollmentRequired: CohortSession['enrollmentRequired'];
  roster: readonly SessionRosterMember[];
  selectedYouthIds: readonly string[];
  loading: boolean;
  error?: string;
  disabled: boolean;
  onToggle: (youthId: string) => void;
}

export default function SessionYouthChecklist({
  enrollmentRequired,
  roster,
  selectedYouthIds,
  loading,
  error,
  disabled,
  onToggle,
}: SessionYouthChecklistProps) {
  return (
    <fieldset className="session-note-youth" disabled={disabled}>
      <legend>Link youth</legend>
      {loading ? (
        <p>Loading youth…</p>
      ) : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : roster.length > 0 ? (
        <Checklist
          variant="form"
          ariaLabel="Link youth"
          options={roster.map(youth => ({ value: youth.youthId, label: `${youth.firstName} ${youth.lastName}` }))}
          value={selectedYouthIds}
          onToggle={onToggle}
          disabled={disabled}
        />
      ) : (
        <p>{!enrollmentRequired
          ? 'No youth have checked into this session yet.'
          : 'No youth are enrolled in this cohort.'}</p>
      )}
    </fieldset>
  );
}
