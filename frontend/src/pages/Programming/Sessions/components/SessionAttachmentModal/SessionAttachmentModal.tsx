import { type FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createSessionAttachment, getSessionRoster } from '../../../../../common/api/cohorts.api';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/ModalFormFooter/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { CohortSession, SessionRosterMember } from '../../../../../common/types/cohort';
import '../SessionNoteModal/SessionNoteModal.css';

export default function SessionAttachmentModal({
  session,
  onClose,
  onSaved,
}: {
  session: CohortSession | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: ['sessions', session?.id, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(session!.id, { signal }),
    enabled: session !== null,
  });
  const roster = rosterQuery.data ?? [];

  useEffect(() => {
    if (!session) return;
    setSelectedYouthIds([]);
    setSubmitStatus('idle');
    setStatusMessage('');
  }, [session]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) return;
    setSubmitStatus('submitting');
    setStatusMessage('Uploading attachment...');
    try {
      const description = String(form.get('description') ?? '').trim();
      await createSessionAttachment(session.id, {
        title: String(form.get('title')).trim(),
        description: description || null,
        youthIds: selectedYouthIds,
        file,
      });
      await onSaved();
      setStatusMessage('Attachment successfully added.');
      setSubmitStatus('success');
    } catch (cause) {
      setStatusMessage(cause instanceof Error ? cause.message : 'Could not add attachment');
      setSubmitStatus('error');
    }
  };

  const complete = submitStatus === 'submitting' || submitStatus === 'success';
  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title="Add Attachment"
      status={submitStatus}
      statusMessage={statusMessage || undefined}
      successDelay={1200}
      disableClose={submitStatus === 'submitting'}
      footer={<ModalFormFooter formId="session-attachment-form" submitLabel="Add Attachment" submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id="session-attachment-form" onSubmit={event => void submit(event)}>
        <FormField id="session-attachment-title" label="Title">
          <input id="session-attachment-title" name="title" maxLength={160} required />
        </FormField>
        <FormField id="session-attachment-file" label="File">
          <input
            id="session-attachment-file"
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx,.xlsx"
            required
          />
        </FormField>
        <FormField id="session-attachment-description" label="Description (optional)">
          <textarea id="session-attachment-description" name="description" rows={4} maxLength={5000} />
        </FormField>
        <fieldset className="session-note-youth" disabled={complete}>
          <legend>Link youth</legend>
          {rosterQuery.isLoading ? <p>Loading youth…</p> : rosterQuery.error ? (
            <p className="form-error" role="alert">
              {rosterQuery.error instanceof Error
                ? rosterQuery.error.message
                : 'Could not load session roster'}
            </p>
          ) : roster.length ? (
            <div className="session-note-youth__checklist">
              {roster.map(youth => (
                <label key={youth.youthId}>
                  <input
                    type="checkbox"
                    checked={selectedYouthIds.includes(youth.youthId)}
                    onChange={() => setSelectedYouthIds(current => current.includes(youth.youthId)
                      ? current.filter(id => id !== youth.youthId)
                      : [...current, youth.youthId])}
                  />
                  <span>{youth.firstName} {youth.lastName}</span>
                </label>
              ))}
            </div>
          ) : <p>{session?.rosterMode === 'open' ? 'No youth have checked into this session yet.' : 'No youth are enrolled in this cohort.'}</p>}
        </fieldset>
      </form>
    </Modal>
  );
}
