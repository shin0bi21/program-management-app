import FormField from '../../../../../../../common/components/FormField/FormField';
import FormFieldGroup from '../../../../../../../common/components/FormField/FormFieldGroup';
import Checklist from '../../../../../../../common/components/Checklist/Checklist';
import Modal from '../../../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../../../common/components/Modal/components/ModalFormFooter';
import type { CohortSession, SessionAttachment } from '../../../../types';
import { useSessionAttachmentModal } from './hooks/useSessionAttachmentModal';
import './SessionAttachmentModal.css';

export default function SessionAttachmentModal({
  queryKey,
  session,
  attachment = null,
  onClose,
  onSaved,
}: {
  queryKey: readonly unknown[];
  session: CohortSession | null;
  attachment?: SessionAttachment | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const workflow = useSessionAttachmentModal({ queryKey, session, attachment, onSaved });
  const { roster, rosterQuery, selectedYouthIds, setSelectedFile, submitStatus, statusMessage, submissionComplete, toggleYouth, submit } = workflow;

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title={attachment ? 'Edit Attachment' : 'Add Attachment'}
      status={submitStatus}
      statusMessage={statusMessage || undefined}
      footer={<ModalFormFooter formId="session-attachment-form" submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id="session-attachment-form" aria-busy={submissionComplete} onSubmit={event => void submit(event)}>
        <FormField id="session-attachment-title" label="Title">
          <input key={`${attachment?.id ?? 'new'}-title`} id="session-attachment-title" name="title" maxLength={160} defaultValue={attachment?.title ?? ''} disabled={submissionComplete} required />
        </FormField>
        {!attachment && <FormField id="session-attachment-file" label="File">
          <input
            id="session-attachment-file"
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx"
            disabled={submissionComplete}
            onChange={event => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
            required
          />
        </FormField>}
        <FormField id="session-attachment-description" label="Description (optional)">
          <textarea key={`${attachment?.id ?? 'new'}-description`} id="session-attachment-description" name="description" rows={4} maxLength={5000} defaultValue={attachment?.description ?? ''} disabled={submissionComplete} />
        </FormField>
        <FormFieldGroup label="Link youth" className="session-attachment-youth" disabled={submissionComplete}>
          {rosterQuery.isLoading ? <p>Loading youth…</p> : rosterQuery.error ? (
            <p className="form-error" role="alert">
              {rosterQuery.error instanceof Error
                ? rosterQuery.error.message
                : 'Could not load session roster'}
            </p>
          ) : roster.length ? (
            <Checklist
              variant="form"
              ariaLabel="Link youth"
              options={roster.map(youth => ({ value: youth.youthId, label: `${youth.firstName} ${youth.lastName}` }))}
              value={selectedYouthIds}
              onToggle={toggleYouth}
              disabled={submissionComplete}
            />
          ) : <p>{session && !session.enrollmentRequired ? 'No youth have checked into this session yet.' : 'No youth are enrolled in this cohort.'}</p>}
        </FormFieldGroup>
      </form>
    </Modal>
  );
}
