import type { CohortSession, SessionRosterMember } from '../../types';

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
        <div className="session-note-youth__checklist">
          {roster.map(youth => (
            <label key={youth.youthId}>
              <input
                type="checkbox"
                checked={selectedYouthIds.includes(youth.youthId)}
                onChange={() => onToggle(youth.youthId)}
              />
              <span>{youth.firstName} {youth.lastName}</span>
            </label>
          ))}
        </div>
      ) : (
        <p>{!enrollmentRequired
          ? 'No youth have checked into this session yet.'
          : 'No youth are enrolled in this cohort.'}</p>
      )}
    </fieldset>
  );
}
