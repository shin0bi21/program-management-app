import { type FormEvent, useEffect, useState } from 'react';
import {
  createSessionNote,
  getSessionRoster,
  updateSessionNote,
} from '../../../../common/api/cohorts.api';
import Button from '../../../../common/components/Button/Button';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import { sessionNoteCategoryOptions } from '../../../../common/components/SessionNoteDetails/SessionNoteDetails';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import type {
  ManagedSession,
  SessionNote,
  SessionNoteCategory,
  SessionRosterMember,
} from '../../../../common/types/cohort';
import './SessionNoteModal.css';

export default function SessionNoteModal({
  session,
  note = null,
  onClose,
  onSaved,
}: {
  session: ManagedSession | null;
  note?: SessionNote | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [roster, setRoster] = useState<SessionRosterMember[]>([]);
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [category, setCategory] = useState<SessionNoteCategory>('general');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    let active = true;
    setRoster([]);
    setSelectedYouthIds(note?.youth.map(youth => youth.youthId) ?? []);
    setCategory(note?.category ?? 'general');
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
  }, [session, note]);

  const toggleYouth = (youthId: string) => {
    setSelectedYouthIds(current => current.includes(youthId)
      ? current.filter(id => id !== youthId)
      : [...current, youthId]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    setSubmitStatus('submitting');
    setStatusMessage(note ? 'Saving session note...' : 'Adding session note...');
    try {
      const data = {
        category,
        title: String(form.get('title')).trim(),
        details: String(form.get('details')).trim(),
        youthIds: selectedYouthIds,
      };
      if (note) {
        await updateSessionNote(session.id, note.id, data);
      } else {
        await createSessionNote(session.id, data);
      }
      await onSaved();
      setStatusMessage(note
        ? 'Session note successfully updated.'
        : 'Session note successfully added.');
      setSubmitStatus('success');
    } catch (cause) {
      setStatusMessage(cause instanceof Error
        ? cause.message
        : `Could not ${note ? 'update' : 'add'} session note`);
      setSubmitStatus('error');
    }
  };

  const complete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title={note ? 'Edit Note' : 'Add Note'}
      status={submitStatus}
      statusMessage={statusMessage || undefined}
      successDelay={1200}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={complete}>Cancel</Button>
        <Button type="submit" form="session-note-form" disabled={complete}>
          {note ? 'Save' : 'Add Note'}
        </Button>
      </>}
    >
      <form id="session-note-form" onSubmit={event => void submit(event)}>
        <FormField id="session-note-category" label="Category">
          <FloatingSelect
            id="session-note-category"
            ariaLabel="Category"
            value={category}
            options={sessionNoteCategoryOptions}
            onChange={value => setCategory(value as SessionNoteCategory)}
          />
        </FormField>
        <FormField id="session-note-title" label="Title">
          <input
            key={`${note?.id ?? 'new'}-title`}
            id="session-note-title"
            name="title"
            maxLength={160}
            defaultValue={note?.title ?? ''}
            required
          />
        </FormField>
        <FormField id="session-note-details" label="Details">
          <textarea
            key={`${note?.id ?? 'new'}-details`}
            id="session-note-details"
            name="details"
            rows={5}
            maxLength={5000}
            defaultValue={note?.details ?? ''}
            required
          />
        </FormField>

        {session && (
          <fieldset className="session-note-youth" disabled={complete}>
            <legend>Link youth</legend>
            {loadingRoster ? (
              <p>Loading youth…</p>
            ) : roster.length > 0 ? (
              <div className="session-note-youth__checklist">
                {roster.map(youth => (
                  <label key={youth.youthId}>
                    <input
                      type="checkbox"
                      checked={selectedYouthIds.includes(youth.youthId)}
                      onChange={() => toggleYouth(youth.youthId)}
                    />
                    <span>{youth.firstName} {youth.lastName}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p>
                {session.rosterMode === 'open'
                  ? 'No youth have checked into this session yet.'
                  : 'No youth are enrolled in this cohort.'}
              </p>
            )}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
