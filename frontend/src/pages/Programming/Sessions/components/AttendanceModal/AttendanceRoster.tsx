import Button from '../../../../../common/components/Button/Button';
import AttendanceStatusSelect from '../../../../../common/features/attendance/components/AttendanceStatusSelect/AttendanceStatusSelect';
import type {
  AttendanceStatus,
  SessionRosterMember,
} from '../../../../../common/types/cohort';

interface AttendanceRosterProps {
  loading: boolean;
  isOpenRoster: boolean;
  roster: SessionRosterMember[];
  selections: Record<string, AttendanceStatus | ''>;
  disabled: boolean;
  onRemove: (youthId: string) => void;
  onStatusChange: (youthId: string, status: AttendanceStatus | '') => void;
}

export default function AttendanceRoster({
  loading,
  isOpenRoster,
  roster,
  selections,
  disabled,
  onRemove,
  onStatusChange,
}: AttendanceRosterProps) {
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
              rosterMode="enrolled"
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
