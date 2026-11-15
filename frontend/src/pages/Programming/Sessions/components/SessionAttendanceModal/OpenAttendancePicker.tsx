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

/**
 * Shows an open session's youth choices with search and incremental checkbox rendering.
 * @param props.youth - Complete choices with unique youth IDs, including any saved attendees.
 * @param props.selectedYouthIds - Youth marked present in the attendance draft.
 * @param props.onToggle - Receives the activated youth ID; the caller updates selectedYouthIds.
 * @example Searching "Person 60" finds that youth beyond the initial 25 choices without clearing other selections.
 */
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
    id: profile.id,
    name: `${profile.firstName} ${profile.lastName}`,
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
