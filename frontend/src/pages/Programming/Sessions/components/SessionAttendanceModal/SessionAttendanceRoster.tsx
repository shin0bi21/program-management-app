import Button from '../../../../../common/components/Button/Button';
import AttendanceStatusSelect from '../../../../../common/features/AttendanceStatusSelect/AttendanceStatusSelect';
import type { AttendanceStatus } from '../../../../../common/features/AttendanceStatusSelect/types';
import type { SessionRosterMember } from '../../types';

interface SessionAttendanceRosterProps {
  loading: boolean;
  isOpenRoster: boolean;
  roster: SessionRosterMember[];
  selections: Record<string, AttendanceStatus | ''>;
  disabled: boolean;
  onRemove: (youthId: string) => void;
  onStatusChange: (youthId: string, status: AttendanceStatus | '') => void;
}

export default function SessionAttendanceRoster({
  loading,
  isOpenRoster,
  roster,
  selections,
  disabled,
  onRemove,
  onStatusChange,
}: SessionAttendanceRosterProps) {
  if (loading) {
    return <p className="page-empty">Loading roster…</p>;
  }

  if (!roster.length) {
    return (
      <p className="page-empty">
        {isOpenRoster
          ? 'No youth have checked in yet.'
          : 'No youth were enrolled for this session.'}
      </p>
    );
  }

  return (
    <div className="attendance-roster">
      {roster.map(member => (
        <div key={member.youthId} className="attendance-roster__row">
          <span>{member.firstName} {member.lastName}</span>
          {isOpenRoster ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRemove(member.youthId)}
              disabled={disabled}
            >
              Remove
            </Button>
          ) : (
            <AttendanceStatusSelect
              id={`attendance-${member.youthId}`}
              ariaLabel={`Attendance for ${member.firstName} ${member.lastName}`}
              enrollmentRequired={true}
              value={selections[member.youthId] ?? ''}
              onChange={value => onStatusChange(member.youthId, value)}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}
