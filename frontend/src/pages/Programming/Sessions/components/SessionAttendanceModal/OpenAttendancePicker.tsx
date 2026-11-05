import Checklist from '../../../../../common/components/Checklist/Checklist';
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
  if (loading) return <p className="page-empty">Loading youth…</p>;
  if (unavailable) return null;
  if (youth.length === 0) return <p className="page-empty">No youth profiles available.</p>;

  const options = youth.map(profile => ({
    value: profile.id,
    label: `${profile.firstName} ${profile.lastName}`,
  }));

  return (
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
