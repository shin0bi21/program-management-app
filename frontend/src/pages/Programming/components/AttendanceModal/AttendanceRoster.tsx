import Button from '../../../../common/components/Button/Button';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import type {
  AttendanceStatus,
  SessionRosterMember,
} from '../../../../common/types/cohort';

const attendanceStatuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

interface AttendanceRosterProps {
  loading: boolean;
  isOpenRoster: boolean;
  roster: SessionRosterMember[];
  selections: Record<string, AttendanceStatus | ''>;
  onRemove: (youthId: string) => void;
  onStatusChange: (youthId: string, status: AttendanceStatus | '') => void;
}

export default function AttendanceRoster({
  loading,
  isOpenRoster,
  roster,
  selections,
  onRemove,
  onStatusChange,
}: AttendanceRosterProps) {
  if (loading) {
    return <p className="programming-empty">Loading roster…</p>;
  }

  if (!roster.length) {
    return (
      <p className="programming-empty">
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
            >
              Remove
            </Button>
          ) : (
            <FloatingSelect
              id={`attendance-${member.youthId}`}
              ariaLabel={`Attendance for ${member.firstName} ${member.lastName}`}
              value={selections[member.youthId] ?? ''}
              onChange={(value) => onStatusChange(
                member.youthId,
                value as AttendanceStatus | '',
              )}
              options={[
                { value: '', label: 'Not marked' },
                ...attendanceStatuses.map(status => ({
                  value: status,
                  label: status[0].toUpperCase() + status.slice(1),
                })),
              ]}
            />
          )}
        </div>
      ))}
    </div>
  );
}
