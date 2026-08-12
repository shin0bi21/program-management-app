import { type FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createSessionAttachment,
  getSessionRoster,
  updateSessionAttachment,
} from '../../../../../../../common/features/programming/api/programming.api';
import FormField from '../../../../../../../common/components/FormField/FormField';
import Modal from '../../../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../../../common/hooks/useSubmitStatus';
import type {
  CohortSession,
  SessionAttachment,
  SessionRosterMember,
} from '../../../../../../../common/types/cohort';
import './SessionAttachmentModal.css';

export default function SessionAttachmentModal({
  session,
  attachment = null,
  onClose,
  onSaved,
}: {
  session: CohortSession | null;
  attachment?: SessionAttachment | null;
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
    setSelectedYouthIds(attachment?.youth.map(youth => youth.youthId) ?? []);
    setSubmitStatus('idle');
    setStatusMessage('');
  }, [attachment, session]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!attachment && (!(file instanceof File) || !file.size)) return;
    setSubmitStatus('submitting');
    setStatusMessage(attachment ? 'Saving attachment...' : 'Uploading attachment...');
    try {
      const description = String(form.get('description') ?? '').trim();
      const data = {
        title: String(form.get('title')).trim(),
        description: description || null,
        youthIds: selectedYouthIds,
      };
      if (attachment) await updateSessionAttachment(session.id, attachment.id, data);
      else await createSessionAttachment(session.id, { ...data, file: file as File });
      await onSaved();
      setStatusMessage(attachment ? 'Attachment successfully updated.' : 'Attachment successfully added.');
      setSubmitStatus('success');
    } catch (cause) {
      setStatusMessage(cause instanceof Error ? cause.message : `Could not ${attachment ? 'update' : 'add'} attachment`);
      setSubmitStatus('error');
    }
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title={attachment ? 'Edit Attachment' : 'Add Attachment'}
      status={submitStatus}
      statusMessage={statusMessage || undefined}
      successDelay={1200}
      footer={<ModalFormFooter formId="session-attachment-form" submitLabel={attachment ? 'Save' : 'Add Attachment'} submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id="session-attachment-form" onSubmit={event => void submit(event)}>
        <FormField id="session-attachment-title" label="Title">
          <input key={`${attachment?.id ?? 'new'}-title`} id="session-attachment-title" name="title" maxLength={160} defaultValue={attachment?.title ?? ''} required />
        </FormField>
        {!attachment && <FormField id="session-attachment-file" label="File">
          <input
            id="session-attachment-file"
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx"
            required
          />
        </FormField>}
        <FormField id="session-attachment-description" label="Description (optional)">
          <textarea key={`${attachment?.id ?? 'new'}-description`} id="session-attachment-description" name="description" rows={4} maxLength={5000} defaultValue={attachment?.description ?? ''} />
        </FormField>
        <fieldset className="session-attachment-youth" disabled={submissionComplete}>
          <legend>Link youth</legend>
          {rosterQuery.isLoading ? <p>Loading youth…</p> : rosterQuery.error ? (
            <p className="form-error" role="alert">
              {rosterQuery.error instanceof Error
                ? rosterQuery.error.message
                : 'Could not load session roster'}
            </p>
          ) : roster.length ? (
            <div className="session-attachment-youth__checklist">
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
