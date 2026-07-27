import { useEffect, useState } from 'react';
import Button from '../../../common/components/Button/Button';
import FloatingSelect from '../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../common/components/Modal/Modal';
import { getSessionRoster, saveSessionAttendance } from '../../../common/api/cohorts.api';
import { getYouth } from '../../../common/api/youth.api';
import type { SubmitStatus } from '../../../common/hooks/useSubmitStatus';
import type {
  AttendanceStatus,
  CohortSession,
  SessionRosterMember,
} from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import YouthModal from '../../Youth/components/YouthModal/YouthModal';
import type { YouthProfile } from '../../../common/types/youth';

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
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<YouthProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [creatingYouth, setCreatingYouth] = useState(false);
  const isOpenRoster = session?.rosterMode === 'open';

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    setSubmitStatus('idle');
    setStatusMessage('');
    setError(null);
    setSearch('');
    setSearchResults([]);
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

  useEffect(() => {
    if (!isOpenRoster || search.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timeout = window.setTimeout(() => {
      getYouth(undefined, { search: search.trim() })
        .then(results => {
          if (!active) return;
          const checkedIn = new Set(roster.map(member => member.youthId));
          setSearchResults(results.filter(profile => !checkedIn.has(profile.id)));
        })
        .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not search youth'); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [isOpenRoster, roster, search]);

  const addOpenAttendee = (profile: Pick<YouthProfile, 'id' | 'firstName' | 'lastName'>) => {
    setRoster(current => current.some(member => member.youthId === profile.id)
      ? current
      : [...current, {
          youthId: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          status: 'present' as const,
          notes: null,
        }].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
    setSearch('');
    setSearchResults([]);
  };

  const save = async () => {
    if (!session) return;
    const sessionName = session.theme || `${session.programName} session`;
    setSubmitStatus('submitting');
    setStatusMessage(`Saving attendance for ${sessionName}...`);
    setError(null);
    try {
      await saveSessionAttendance(
        session.id,
        isOpenRoster
          ? roster.map(member => ({ youthId: member.youthId, status: 'present' as const, notes: member.notes }))
          : roster.flatMap(member => {
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
    <>
    <Modal
      isOpen={session !== null && !creatingYouth}
      onClose={onClose}
      title="Attendance"
      maxWidth="720px"
      status={submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>Cancel</Button>
        <Button
          onClick={() => void save()}
          disabled={submissionComplete || loading || (!isOpenRoster && !roster.length)}
        >
          Save Attendance
        </Button>
      </>}
    >
      {session && (
        <p className="attendance-modal__context">
          {session.programName} · {session.cohortName} · {formatShortDate(session.startsAt)}
          {session.theme ? ` · ${session.theme}` : ''}
        </p>
      )}
      {error && submitStatus === 'idle' && <p className="form-error">{error}</p>}
      {isOpenRoster && (
        <div className="open-attendance-picker">
          <div className="open-attendance-picker__controls">
            <SearchInput
              label="Find youth profile"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search youth profiles"
            />
            <Button variant="secondary" onClick={() => setCreatingYouth(true)}>
              + Create Profile
            </Button>
          </div>
          {search.trim().length >= 2 && (
            <div className="open-attendance-results" aria-label="Youth profile results">
              {searching ? <p className="programming-empty">Searching…</p> : searchResults.length ? (
                searchResults.map(profile => (
                  <div className="open-attendance-results__row" key={profile.id}>
                    <span>{profile.firstName} {profile.lastName}</span>
                    <Button size="sm" variant="secondary" onClick={() => addOpenAttendee(profile)}>
                      Check in
                    </Button>
                  </div>
                ))
              ) : <p className="programming-empty">No matching profiles.</p>}
            </div>
          )}
        </div>
      )}
      {loading ? <p className="programming-empty">Loading roster…</p> : roster.length ? (
        <div className="attendance-roster">
          {roster.map(member => (
            <div key={member.youthId} className="attendance-roster__row">
              <span>{member.firstName} {member.lastName}</span>
              {isOpenRoster ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRoster(current => current.filter(item => item.youthId !== member.youthId))}
                >
                  Remove
                </Button>
              ) : (
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
              )}
            </div>
          ))}
        </div>
      ) : <p className="programming-empty">
        {isOpenRoster ? 'No youth have checked in yet.' : 'No youth were enrolled for this session.'}
      </p>}
    </Modal>
    <YouthModal
      isOpen={creatingYouth}
      onClose={() => setCreatingYouth(false)}
      onSuccess={profile => {
        addOpenAttendee(profile);
        setCreatingYouth(false);
      }}
    />
    </>
  );
}
