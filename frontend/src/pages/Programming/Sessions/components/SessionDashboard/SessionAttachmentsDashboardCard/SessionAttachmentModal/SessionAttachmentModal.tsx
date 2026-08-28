import FormField from '../../../../../../../common/components/FormField/FormField';
import Modal from '../../../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../../../common/components/Modal/components/ModalFormFooter';
import type { CohortSession, SessionAttachment } from '../../../../../../../common/types/cohort';
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
      successDelay={1200}
      footer={<ModalFormFooter formId="session-attachment-form" submitLabel={attachment ? 'Save' : 'Add Attachment'} submitStatus={submitStatus} onClose={onClose} />}
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
                    onChange={() => toggleYouth(youth.youthId)}
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
