import { type FormEvent, useEffect, useState } from 'react';
import { updateSession } from '../../../../common/api/cohorts.api';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import type { ManagedSession } from '../../../../common/types/cohort';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { useSessionTypes } from '../../hooks/useSessionTypes';

const localDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

interface EditSessionModalProps {
  session: ManagedSession | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export default function EditSessionModal({ session, onClose, onUpdated }: EditSessionModalProps) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const sessionTypes = useSessionTypes();
  const [sessionTypeId, setSessionTypeId] = useState('');

  useEffect(() => {
    if (!session) return;
    setStatus('idle');
    setStatusMessage('');
    setSessionTypeId(session.sessionTypeId);
  }, [session]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    setStatus('submitting');
    setStatusMessage('Updating session...');
    try {
      await updateSession(session.id, {
        sessionTypeId,
        theme: String(form.get('theme')).trim() || null,
        startsAt: new Date(String(form.get('startsAt'))).toISOString(),
        endsAt: new Date(String(form.get('endsAt'))).toISOString(),
        description: String(form.get('description')).trim() || null,
      });
      await onUpdated();
      setStatusMessage('Session updated successfully.');
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not update session'));
      setStatus('error');
    }
  };

  const complete = status === 'submitting' || status === 'success';

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title="Edit session"
      status={status}
      statusMessage={statusMessage}
      successDelay={1200}
      disableClose={complete}
      footer={(
        <ModalFormFooter
          formId="edit-session-form"
          submitLabel="Save Changes"
          submitStatus={status}
          submitDisabled={!sessionTypeId}
          onClose={onClose}
        />
      )}
    >
      {session && (
        <form id="edit-session-form" onSubmit={(event) => void submit(event)}>
          <FormField id="edit-session-type" label="Type">
            <FloatingSelect
              id="edit-session-type"
              value={sessionTypeId}
              onChange={setSessionTypeId}
              options={sessionTypes.map(type => ({ value: type.id, label: type.name }))}
            />
          </FormField>
          <FormField id="edit-session-theme" label="Theme (optional)">
            <input id="edit-session-theme" name="theme" defaultValue={session.theme ?? ''} maxLength={160} />
          </FormField>
          <div className="form-row edit-session-time-row">
            <FormField id="edit-session-start" label="Starts at">
              <input
                id="edit-session-start"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={localDateTime(session.startsAt)}
              />
            </FormField>
            <FormField id="edit-session-end" label="Ends at">
              <input
                id="edit-session-end"
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={localDateTime(session.endsAt)}
              />
            </FormField>
          </div>
          <FormField id="edit-session-description" label="Description">
            <textarea
              id="edit-session-description"
              name="description"
              defaultValue={session.description ?? ''}
              maxLength={5000}
            />
          </FormField>
        </form>
      )}
    </Modal>
  );
}
