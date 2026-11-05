import AttendanceStatusSelect from '../../../../../common/features/AttendanceStatusSelect/AttendanceStatusSelect';
import type { AttendanceStatus } from '../../../../../common/features/AttendanceStatusSelect/types';
import type { SessionRosterMember } from '../../types';

interface SessionAttendanceRosterProps {
  loading: boolean;
  roster: SessionRosterMember[];
  selections: Record<string, AttendanceStatus | ''>;
  disabled: boolean;
  onStatusChange: (youthId: string, status: AttendanceStatus | '') => void;
}

export default function SessionAttendanceRoster({
  loading,
  roster,
  selections,
  disabled,
  onStatusChange,
}: SessionAttendanceRosterProps) {
  if (loading) {
    return <p className="page-empty">Loading roster…</p>;
  }

  if (!roster.length) {
    return (
      <p className="page-empty">
        No youth were enrolled for this session.
      </p>
    );
  }

  return (
    <div className="attendance-roster">
      {roster.map(member => (
        <div key={member.youthId} className="attendance-roster__row">
          <span>{member.firstName} {member.lastName}</span>
          <AttendanceStatusSelect
            id={`attendance-${member.youthId}`}
            ariaLabel={`Attendance for ${member.firstName} ${member.lastName}`}
            enrollmentRequired={true}
            value={selections[member.youthId] ?? ''}
            onChange={value => onStatusChange(member.youthId, value)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
