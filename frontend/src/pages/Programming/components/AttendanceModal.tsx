import { useEffect, useState } from 'react';
import Button from '../../../common/components/Button/Button';
import FloatingSelect from '../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../common/components/Modal/Modal';
import { getSessionRoster, saveSessionAttendance } from '../../../common/api/cohorts.api';
import type { SubmitStatus } from '../../../common/hooks/useSubmitStatus';
import type {
  AttendanceStatus,
  CohortSession,
  SessionRosterMember,
} from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';

interface AttendanceModalProps {
  session: CohortSession | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

export default function AttendanceModal({ session, onClose, onSaved }: AttendanceModalProps) {
  const [roster, setRoster] = useState<SessionRosterMember[]>([]);
  const [selections, setSelections] = useState<Record<string, AttendanceStatus | ''>>({});
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    setSubmitStatus('idle');
    setStatusMessage('');
    setError(null);
    getSessionRoster(session.id)
      .then(data => {
        if (!active) return;
        setRoster(data);
        setSelections(Object.fromEntries(data.map(member => [member.youthId, member.status ?? ''])));
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load roster'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session]);

  const save = async () => {
    if (!session) return;
    const sessionName = session.focus || session.activityName;
    setSubmitStatus('submitting');
    setStatusMessage(`Saving attendance for ${sessionName}...`);
    setError(null);
    try {
      await saveSessionAttendance(
        session.id,
        roster.flatMap(member => {
          const status = selections[member.youthId];
          return status ? [{ youthId: member.youthId, status, notes: member.notes }] : [];
        }),
      );
      await onSaved();
      setStatusMessage(`Attendance successfully saved for ${sessionName}.`);
      setSubmitStatus('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save attendance';
      setError(message);
      setStatusMessage(message);
      setSubmitStatus('error');
    }
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title={session ? `${session.focus || session.activityName} attendance` : 'Attendance'}
      maxWidth="720px"
      status={submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>Cancel</Button>
        <Button onClick={() => void save()} disabled={submissionComplete || loading || !roster.length}>
          Save Attendance
        </Button>
      </>}
    >
      {session && (
        <p className="attendance-modal__context">
          {session.programName} · {session.cohortName} · {formatShortDate(session.startsAt)}
        </p>
      )}
      {error && submitStatus === 'idle' && <p className="form-error">{error}</p>}
      {loading ? <p className="programming-empty">Loading roster…</p> : roster.length ? (
        <div className="attendance-roster">
          {roster.map(member => (
            <div key={member.youthId} className="attendance-roster__row">
              <span>{member.firstName} {member.lastName}</span>
              <FloatingSelect
                id={`attendance-${member.youthId}`}
                ariaLabel={`Attendance for ${member.firstName} ${member.lastName}`}
                value={selections[member.youthId] ?? ''}
                onChange={value => setSelections(current => ({
                  ...current,
                  [member.youthId]: value as AttendanceStatus | '',
                }))}
                options={[
                  { value: '', label: 'Not marked' },
                  ...statuses.map(status => ({
                    value: status,
                    label: status[0].toUpperCase() + status.slice(1),
                  })),
                ]}
              />
            </div>
          ))}
        </div>
      ) : <p className="programming-empty">No youth were enrolled for this session.</p>}
    </Modal>
  );
}
