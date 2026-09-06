import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { CohortSession } from '../../types';
import { useEditSessionModal } from './hooks/useEditSessionModal';

const localDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

interface EditSessionModalProps {
  session: CohortSession | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export default function EditSessionModal({ session, onClose, onUpdated }: EditSessionModalProps) {
  const {
    status, statusMessage, submissionComplete, sessionTypeId, setSessionTypeId, sessionTypes, submit,
  } = useEditSessionModal(session, onUpdated);

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title="Edit Session"
      status={status}
      statusMessage={statusMessage}
      successDelay={1200}
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
              disabled={submissionComplete}
            />
          </FormField>
          <FormField id="edit-session-theme" label="Title / Theme">
            <input id="edit-session-theme" name="theme" required defaultValue={session.theme} maxLength={160} disabled={submissionComplete} />
          </FormField>
          <div className="form-row edit-session-time-row">
            <FormField id="edit-session-start" label="Starts at">
              <input
                id="edit-session-start"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={localDateTime(session.startsAt)}
                disabled={submissionComplete}
              />
            </FormField>
            <FormField id="edit-session-end" label="Ends at">
              <input
                id="edit-session-end"
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={localDateTime(session.endsAt)}
                disabled={submissionComplete}
              />
            </FormField>
          </div>
          <FormField id="edit-session-description" label="Description">
            <textarea
              id="edit-session-description"
              name="description"
              defaultValue={session.description ?? ''}
              maxLength={5000}
              disabled={submissionComplete}
            />
          </FormField>
        </form>
      )}
    </Modal>
  );
}
