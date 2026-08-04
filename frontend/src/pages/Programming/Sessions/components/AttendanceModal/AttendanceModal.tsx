import { type FormEvent, useEffect, useState } from 'react';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/ModalFormFooter/ModalFormFooter';
import { getSessionRoster, saveSessionAttendance } from '../../../../../common/api/cohorts.api';
import { getYouth } from '../../../../../common/api/youth.api';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type {
  AttendanceStatus,
  CohortSession,
  SessionRosterMember,
} from '../../../../../common/types/cohort';
import { formatShortDate } from '../../../../../common/utils/date';
import type { YouthProfile } from '../../../../../common/types/youth';
import YouthModal from '../../../../Youth/components/YouthModal/YouthModal';
import AttendanceRoster from './AttendanceRoster';
import OpenAttendancePicker from './OpenAttendancePicker';

interface AttendanceModalProps {
  session: CohortSession | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

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

  const removeOpenAttendee = (youthId: string) => {
    setRoster(current => current.filter(member => member.youthId !== youthId));
  };

  const updateAttendanceStatus = (youthId: string, status: AttendanceStatus | '') => {
    setSelections(current => ({ ...current, [youthId]: status }));
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  const handleYouthCreated = (profile: YouthProfile) => {
    addOpenAttendee(profile);
    setCreatingYouth(false);
  };

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
        footer={(
          <ModalFormFooter
            formId="attendance-form"
            submitLabel="Save Attendance"
            submitStatus={submitStatus}
            submitDisabled={loading || (!isOpenRoster && !roster.length)}
            onClose={onClose}
          />
        )}
      >
        <form id="attendance-form" onSubmit={submit}>
          {session && (
            <p className="attendance-modal__context">
              {formatShortDate(session.startsAt)}
              {session.theme ? ` · ${session.theme}` : ''}
            </p>
          )}

          {error && submitStatus === 'idle' && <p className="form-error">{error}</p>}

          {isOpenRoster && (
            <OpenAttendancePicker
              search={search}
              searchResults={searchResults}
              searching={searching}
              onSearchChange={setSearch}
              onCreateProfile={() => setCreatingYouth(true)}
              onCheckIn={addOpenAttendee}
            />
          )}

          <AttendanceRoster
            loading={loading}
            isOpenRoster={isOpenRoster}
            roster={roster}
            selections={selections}
            onRemove={removeOpenAttendee}
            onStatusChange={updateAttendanceStatus}
          />
        </form>
      </Modal>

      <YouthModal
        isOpen={creatingYouth}
        onClose={() => setCreatingYouth(false)}
        onSuccess={handleYouthCreated}
      />
    </>
  );
}
