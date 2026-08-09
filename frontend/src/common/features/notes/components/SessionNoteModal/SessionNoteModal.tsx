import { type FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createSessionNote, getSessionRoster, updateSessionNote } from '../../../../features/programming/api/programming.api';
import FloatingSelect from '../../../../components/FloatingSelect/FloatingSelect';
import FormField from '../../../../components/FormField/FormField';
import Modal from '../../../../components/Modal/Modal';
import ModalFormFooter from '../../../../components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../hooks/useSubmitStatus';
import type { CohortSession, SessionNote, SessionNoteCategory, SessionRosterMember } from '../../../../types/cohort';
import { sessionNoteCategoryOptions } from '../../sessionNoteCategories';
import './SessionNoteModal.css';

export default function SessionNoteModal({
  session,
  note = null,
  initialYouthId,
  hideYouthSelection = false,
  closeOnSuccess = false,
  onClose,
  onSaved,
}: {
  session: Pick<CohortSession, 'id' | 'rosterMode'> | null;
  note?: SessionNote | null;
  initialYouthId?: string;
  hideYouthSelection?: boolean;
  closeOnSuccess?: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [category, setCategory] = useState<SessionNoteCategory>('general');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: ['sessions', session?.id, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(session!.id, { signal }),
    enabled: session !== null && !hideYouthSelection,
  });
  const roster = rosterQuery.data ?? [];

  useEffect(() => {
    if (!session) return;
    setSelectedYouthIds(note?.youth.map(youth => youth.youthId) ?? (initialYouthId ? [initialYouthId] : []));
    setCategory(note?.category ?? 'general');
    setSubmitStatus('idle');
    setStatusMessage('');
  }, [initialYouthId, session, note]);

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
      const details = form.get('details');
      const data = {
        category,
        title: String(form.get('title')).trim(),
        details: typeof details === 'string' && details.trim() ? details.trim() : null,
        youthIds: selectedYouthIds,
      };
      if (note) await updateSessionNote(session.id, note.id, data);
      else await createSessionNote(session.id, data);
      await onSaved();
      if (closeOnSuccess) {
        onClose();
        return;
      }
      setStatusMessage(note ? 'Session note successfully updated.' : 'Session note successfully added.');
      setSubmitStatus('success');
    } catch (cause) {
      setStatusMessage(cause instanceof Error ? cause.message : `Could not ${note ? 'update' : 'add'} session note`);
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
      footer={<ModalFormFooter formId="session-note-form" submitLabel={note ? 'Save' : 'Add Note'} submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id="session-note-form" onSubmit={event => void submit(event)}>
        <FormField id="session-note-title" label="Title">
          <input key={`${note?.id ?? 'new'}-title`} id="session-note-title" name="title" maxLength={160} defaultValue={note?.title ?? ''} required />
        </FormField>
        <FormField id="session-note-category" label="Category">
          <FloatingSelect id="session-note-category" ariaLabel="Category" value={category} options={sessionNoteCategoryOptions} onChange={value => setCategory(value as SessionNoteCategory)} />
        </FormField>
        <FormField id="session-note-details" label="Details (optional)">
          <textarea key={`${note?.id ?? 'new'}-details`} id="session-note-details" name="details" rows={5} maxLength={5000} defaultValue={note?.details ?? ''} />
        </FormField>
        {session && !hideYouthSelection && (
          <fieldset className="session-note-youth" disabled={complete}>
            <legend>Link youth</legend>
            {rosterQuery.isLoading ? <p>Loading youth…</p> : rosterQuery.error ? (
              <p className="form-error" role="alert">{rosterQuery.error instanceof Error ? rosterQuery.error.message : 'Could not load session roster'}</p>
            ) : roster.length > 0 ? (
              <div className="session-note-youth__checklist">
                {roster.map(youth => (
                  <label key={youth.youthId}>
                    <input type="checkbox" checked={selectedYouthIds.includes(youth.youthId)} onChange={() => toggleYouth(youth.youthId)} />
                    <span>{youth.firstName} {youth.lastName}</span>
                  </label>
                ))}
              </div>
            ) : <p>{session.rosterMode === 'open' ? 'No youth have checked into this session yet.' : 'No youth are enrolled in this cohort.'}</p>}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
