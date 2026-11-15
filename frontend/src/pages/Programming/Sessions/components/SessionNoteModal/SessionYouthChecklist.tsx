import type { ProgramSession, SessionRosterMember } from '../../types';
import Checklist from '../../../../../common/components/Checklist/Checklist';
import FormFieldGroup from '../../../../../common/components/FormField/FormFieldGroup';

interface SessionYouthChecklistProps {
  enrollmentRequired: ProgramSession['enrollmentRequired'];
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
    <FormFieldGroup label="Link youth" className="session-note-youth" disabled={disabled}>
      {loading ? (
        <p>Loading youth…</p>
      ) : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : roster.length > 0 ? (
        <Checklist
          variant="form"
          ariaLabel="Link youth"
          options={roster.map(youth => ({ id: youth.youthId, name: `${youth.firstName} ${youth.lastName}` }))}
          value={selectedYouthIds}
          onToggle={onToggle}
          disabled={disabled}
        />
      ) : (
        <p>{!enrollmentRequired
          ? 'No youth have checked into this session yet.'
          : 'No youth are enrolled in this cycle.'}</p>
      )}
    </FormFieldGroup>
  );
}
