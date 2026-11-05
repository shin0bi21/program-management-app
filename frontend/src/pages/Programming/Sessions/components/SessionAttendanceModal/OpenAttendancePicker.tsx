import Checklist from '../../../../../common/components/Checklist/Checklist';
import FormFieldGroup from '../../../../../common/components/FormField/FormFieldGroup';
import type { AttendanceYouth } from '../../sessions.api';

interface OpenAttendancePickerProps {
  youth: readonly AttendanceYouth[];
  selectedYouthIds: readonly string[];
  loading: boolean;
  unavailable: boolean;
  disabled: boolean;
  onToggle: (youthId: string) => void;
}

export default function OpenAttendancePicker({
  youth,
  selectedYouthIds,
  loading,
  unavailable,
  disabled,
  onToggle,
}: OpenAttendancePickerProps) {
  return (
    <FormFieldGroup label="Youth attendance" disabled={disabled}>
      {loading ? (
        <p className="page-empty">Loading youth…</p>
      ) : unavailable ? null : youth.length === 0 ? (
        <p className="page-empty">No youth profiles available.</p>
      ) : (
        <Checklist
          variant="form"
          ariaLabel="Youth attendance"
          options={youth.map(profile => ({ value: profile.id, label: `${profile.firstName} ${profile.lastName}` }))}
          value={selectedYouthIds}
          onToggle={onToggle}
          disabled={disabled}
          search
          dynamicItems
        />
      )}
    </FormFieldGroup>
  );
}
