import { type FormEvent, useEffect, useState } from 'react';
import { createSessionNote, getSessionRoster } from '../../../../common/api/cohorts.api';
import Button from '../../../../common/components/Button/Button';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import type { ManagedSession, SessionRosterMember } from '../../../../common/types/cohort';
import './SessionNoteModal.css';

export default function SessionNoteModal({
  session,
  onClose,
  onSaved,
}: {
  session: ManagedSession | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [roster, setRoster] = useState<SessionRosterMember[]>([]);
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    let active = true;
    setRoster([]);
    setSelectedYouthIds([]);
    setSubmitStatus('idle');
    setStatusMessage('');
    setLoadingRoster(true);
    getSessionRoster(session.id)
      .then(rows => { if (active) setRoster(rows); })
      .catch(cause => {
        if (!active) return;
        setStatusMessage(cause instanceof Error ? cause.message : 'Could not load cohort youth');
        setSubmitStatus('error');
      })
      .finally(() => { if (active) setLoadingRoster(false); });
    return () => { active = false; };
  }, [session]);

  const toggleYouth = (youthId: string) => {
    setSelectedYouthIds(current => current.includes(youthId)
      ? current.filter(id => id !== youthId)
      : [...current, youthId]);
  };

  const availableYouth = roster.filter(youth => !selectedYouthIds.includes(youth.youthId));
  const selectedYouth = selectedYouthIds
    .map(id => roster.find(youth => youth.youthId === id))
    .filter((youth): youth is SessionRosterMember => Boolean(youth));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    setSubmitStatus('submitting');
    setStatusMessage('Adding session note...');
    try {
      await createSessionNote(session.id, {
        note: String(form.get('note')).trim(),
        youthIds: selectedYouthIds,
      });
      await onSaved();
      setStatusMessage('Session note successfully added.');
      setSubmitStatus('success');
    } catch (cause) {
      setStatusMessage(cause instanceof Error ? cause.message : 'Could not add session note');
      setSubmitStatus('error');
    }
  };

  const complete = submitStatus === 'submitting' || submitStatus === 'success';
  const sessionLabel = session?.theme || (session ? `${session.programName} session` : '');
  let rosterPlaceholder = 'No youth available';
  if (loadingRoster) {
    rosterPlaceholder = 'Loading youth...';
  } else if (roster.length) {
    rosterPlaceholder = 'Link youth';
  }

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title={`Add note to ${sessionLabel}`}
      status={submitStatus}
      statusMessage={statusMessage || undefined}
      successDelay={1200}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={complete}>Cancel</Button>
        <Button type="submit" form="session-note-form" disabled={complete}>
          Add Note
        </Button>
      </>}
    >
      <form id="session-note-form" onSubmit={event => void submit(event)}>
        <FormField id="session-note" label="Session note">
          <textarea id="session-note" name="note" rows={5} maxLength={5000} required />
        </FormField>

        {session && (
          <section className="session-note-youth" aria-labelledby="session-note-youth-title">
            <div className="session-note-youth__header">
              <h3 id="session-note-youth-title">Linked youth</h3>
              <span>Optional</span>
            </div>
            <p className="session-note-youth__help">
              {session.rosterMode === 'open'
                ? 'Choose from youth checked into this session.'
                : `Choose from youth enrolled in ${session.programName} - ${session.cohortName}.`}
            </p>
            <FloatingSelect
              id="session-note-link-youth"
              ariaLabel="Link youth"
              value=""
              options={availableYouth.map(youth => ({
                value: youth.youthId,
                label: `${youth.firstName} ${youth.lastName}`,
              }))}
              onChange={toggleYouth}
              placeholder={rosterPlaceholder}
              disabled={loadingRoster || availableYouth.length === 0}
            />
            {!loadingRoster && roster.length === 0 && (
              <p>
                {session.rosterMode === 'open'
                  ? 'No youth have checked into this session yet.'
                  : 'No youth are enrolled in this cohort.'}
              </p>
            )}
            {selectedYouth.length > 0 && (
              <div className="session-note-youth__linked" aria-label="Youth linked to this note">
                {selectedYouth.map(youth => (
                  <div key={youth.youthId}>
                    <span>{youth.firstName} {youth.lastName}</span>
                    <button
                      type="button"
                      onClick={() => toggleYouth(youth.youthId)}
                      aria-label={`Remove ${youth.firstName} ${youth.lastName}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </form>
    </Modal>
  );
}
