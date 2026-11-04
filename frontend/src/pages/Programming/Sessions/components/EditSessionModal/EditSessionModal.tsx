import type { UpdatedSessionResult } from '../../sessions.api';
import { toFilterOptions } from '../../../../../common/features/referenceData/filterOptions';
import { sessionDateTime } from '../../utils/sessionSchedule';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramSession } from '../../types';
import { useEditSessionModal } from './hooks/useEditSessionModal';

interface EditSessionModalProps {
  session: ProgramSession | null;
  timezone?: string;
  onClose: () => void;
  onUpdated: (result: UpdatedSessionResult) => void | Promise<void>;
}

export default function EditSessionModal({ session, onClose, onUpdated, timezone = 'America/Toronto' }: EditSessionModalProps) {
  const {
    status, statusMessage, submissionComplete, sessionTypeId, setSessionTypeId, sessionTypes, submit,
  } = useEditSessionModal(session, onUpdated, timezone);

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title="Edit Session"
      status={status}
      statusMessage={statusMessage}
      footer={(
        <ModalFormFooter
          formId="edit-session-form"
          submitStatus={status}
          submitDisabled={!sessionTypeId}
          onClose={onClose}
        />
      )}
    >
      {session && (
        <form key={session.id} id="edit-session-form" onSubmit={(event) => void submit(event)}>
          <FormField id="edit-session-type" label="Type">
            <FloatingSelect
              id="edit-session-type"
              value={sessionTypeId}
              onChange={setSessionTypeId}
              options={toFilterOptions(sessionTypes)}
              disabled={submissionComplete}
            />
          </FormField>
          <FormField id="edit-session-theme" label="Title / Theme">
            <input id="edit-session-theme" name="theme" required defaultValue={session.theme} maxLength={160} disabled={submissionComplete} />
          </FormField>
          <FormField id="edit-session-date" label="Session Date">
            <input id="edit-session-date" name="date" type="date" required
              defaultValue={sessionDateTime(session.startsAt, timezone).date} disabled={submissionComplete} />
          </FormField>
          <div className="form-row edit-session-time-row">
            <FormField id="edit-session-start" label="Start Time">
              <input id="edit-session-start" name="startTime" type="time" required
                defaultValue={sessionDateTime(session.startsAt, timezone).time} disabled={submissionComplete} />
            </FormField>
            <FormField id="edit-session-end" label="End Time">
              <input id="edit-session-end" name="endTime" type="time" required
                defaultValue={sessionDateTime(session.endsAt, timezone).time} disabled={submissionComplete} />
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
