import type { FormEvent } from 'react';

import FloatingSelect from '../../../../components/FloatingSelect/FloatingSelect';
import FormField from '../../../../components/FormField/FormField';
import Modal from '../../../../components/Modal/Modal';
import ModalFormFooter from '../../../../components/Modal/components/ModalFormFooter';
import type { SessionNoteCategory } from '../../../../types/cohort';
import { sessionNoteCategoryOptions } from '../../sessionNoteCategories';
import useSessionNoteModal, { type UseSessionNoteModalOptions } from './hooks/useSessionNoteModal';
import SessionYouthChecklist from './SessionYouthChecklist';
import './SessionNoteModal.css';

type SessionNoteModalProps = UseSessionNoteModalOptions & {
  onClose: () => void;
};

export default function SessionNoteModal({
  session,
  note = null,
  initialYouthId,
  hideYouthSelection = false,
  onClose,
  onSaved,
}: SessionNoteModalProps) {
  const workflow = useSessionNoteModal({
    session,
    note,
    initialYouthId,
    hideYouthSelection,
    onSaved,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void workflow.submit();
  };

  const footer = (
    <ModalFormFooter
      formId="session-note-form"
      submitLabel={note ? 'Save' : 'Add Note'}
      submitStatus={workflow.submitStatus}
      onClose={onClose}
    />
  );

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title={note ? 'Edit Note' : 'Add Note'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1200}
      footer={footer}
    >
      <form id="session-note-form" onSubmit={submit}>
        <FormField id="session-note-title" label="Title">
          <input
            id="session-note-title"
            maxLength={160}
            value={workflow.draft.title}
            onChange={event => workflow.updateTitle(event.target.value)}
            required
            disabled={workflow.submissionComplete}
          />
        </FormField>

        <FormField id="session-note-category" label="Category">
          <FloatingSelect
            id="session-note-category"
            ariaLabel="Category"
            value={workflow.draft.category}
            options={sessionNoteCategoryOptions}
            onChange={value => workflow.updateCategory(value as SessionNoteCategory)}
            disabled={workflow.submissionComplete}
          />
        </FormField>

        <FormField id="session-note-details" label="Details (optional)">
          <textarea
            id="session-note-details"
            rows={5}
            maxLength={5000}
            value={workflow.draft.details}
            onChange={event => workflow.updateDetails(event.target.value)}
            disabled={workflow.submissionComplete}
          />
        </FormField>

        {session && !hideYouthSelection && (
          <SessionYouthChecklist
            rosterMode={session.rosterMode}
            roster={workflow.roster}
            selectedYouthIds={workflow.draft.selectedYouthIds}
            loading={workflow.rosterLoading}
            error={workflow.rosterError}
            disabled={workflow.submissionComplete}
            onToggle={workflow.toggleYouth}
          />
        )}
      </form>
    </Modal>
  );
}
