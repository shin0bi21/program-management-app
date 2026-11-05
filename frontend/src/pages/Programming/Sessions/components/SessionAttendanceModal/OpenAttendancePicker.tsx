import type { ReactNode } from 'react';
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
  let content: ReactNode;
  if (loading) {
    content = <p className="page-empty">Loading youth…</p>;
  } else if (unavailable) {
    content = null;
  } else if (youth.length === 0) {
    content = <p className="page-empty">No youth profiles available.</p>;
  } else {
    const options = youth.map(profile => ({
      value: profile.id,
      label: `${profile.firstName} ${profile.lastName}`,
    }));

    content = (
      <Checklist
        variant="form"
        ariaLabel="Youth attendance"
        options={options}
        value={selectedYouthIds}
        onToggle={onToggle}
        disabled={disabled}
        search
        dynamicItems
      />
    );
  }

  return (
    <FormFieldGroup label="Youth attendance" disabled={disabled}>
      {content}
    </FormFieldGroup>
  );
}
