import FormField from '../../../../../../../common/components/FormField/FormField';
import FormFieldGroup from '../../../../../../../common/components/FormField/FormFieldGroup';
import Checklist from '../../../../../../../common/components/Checklist/Checklist';
import Modal from '../../../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramSession, SessionAttachment } from '../../../../types';
import { useSessionAttachmentModal } from './hooks/useSessionAttachmentModal';
import { getErrorMessage } from '../../../../../../../http/errors';
import './SessionAttachmentModal.css';

interface SessionAttachmentModalProps {
  queryKey: readonly unknown[];
  session: ProgramSession | null;
  attachment?: SessionAttachment | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/**
 * Mounts one attachment draft for the supplied open session and saved attachment.
 * @param props - Saved targets, roster query scope, and close/save actions.
 * @example <SessionAttachmentModal queryKey={['sessions']} session={session} onClose={close} onSaved={refresh} />
 */
export default function SessionAttachmentModal({ session, ...props }: SessionAttachmentModalProps) {
  return session ? <AttachmentForm key={`${session.id}:${props.attachment?.id ?? 'new'}`} session={session} {...props} /> : null;
}

/**
 * Owns attachment fields and upload selection until close or successful completion.
 * @param props - Saved session/attachment and completion actions.
 * @example <AttachmentForm queryKey={['sessions']} session={session} onClose={close} onSaved={refresh} />
 */
function AttachmentForm({ queryKey, session, attachment = null, onClose, onSaved }: Omit<SessionAttachmentModalProps, 'session'> & { session: ProgramSession }) {
  const workflow = useSessionAttachmentModal({ queryKey, session, attachment, onSaved });
  const { roster, rosterQuery, selectedYouthIds, setSelectedFile, submitStatus, statusMessage, submissionComplete, toggleYouth, submit } = workflow;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={attachment ? 'Edit Attachment' : 'Add Attachment'}
      status={submitStatus}
      statusMessage={statusMessage || undefined}
      footer={<ModalFormFooter formId="session-attachment-form" submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id="session-attachment-form" aria-busy={submissionComplete} onSubmit={event => void submit(event)}>
        <FormField id="session-attachment-title" label="Title">
          <input id="session-attachment-title" name="title" maxLength={160} defaultValue={attachment?.title ?? ''} disabled={submissionComplete} required />
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
          <textarea id="session-attachment-description" name="description" rows={4} maxLength={5000} defaultValue={attachment?.description ?? ''} disabled={submissionComplete} />
        </FormField>
        <FormFieldGroup label="Link youth" className="session-attachment-youth" disabled={submissionComplete}>
          {rosterQuery.isLoading && <p>Loading youth…</p>}
          {!rosterQuery.isLoading && rosterQuery.error && (
            <p className="form-error" role="alert">
              {getErrorMessage(rosterQuery.error, 'Could not load session roster')}
            </p>
          )}
          {!rosterQuery.isLoading && !rosterQuery.error && roster.length > 0 && (
            <Checklist
              variant="form"
              ariaLabel="Link youth"
              options={roster.map(youth => ({ value: youth.youthId, label: `${youth.firstName} ${youth.lastName}` }))}
              value={selectedYouthIds}
              onToggle={toggleYouth}
              disabled={submissionComplete}
            />
          )}
          {!rosterQuery.isLoading && !rosterQuery.error && roster.length === 0 && <p>{!session.enrollmentRequired ? 'No youth have checked into this session yet.' : 'No youth are enrolled in this cycle.'}</p>}
        </FormFieldGroup>
      </form>
    </Modal>
  );
}
