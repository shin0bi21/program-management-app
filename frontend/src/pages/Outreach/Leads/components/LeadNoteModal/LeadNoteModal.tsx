import { type FormEvent, useEffect, useState } from 'react';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/clientErrors';
import { setLeadNote } from '../../api/leads.api';
import type { Lead, LeadNote } from '../../types';

export default function LeadNoteModal({
  lead,
  note,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  note: LeadNote | null;
  onClose: () => void;
  onSaved: (savedNote: LeadNote) => void;
}) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!lead) return;
    setStatus('idle');
    setStatusMessage('');
  }, [lead, note]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead) return;
    const details = String(new FormData(event.currentTarget).get('details')).trim();
    setStatus('submitting');
    setStatusMessage(note ? 'Updating follow-up note...' : 'Adding follow-up note...');
    try {
      const savedNote = note
        ? await setLeadNote(lead.id, details, note.id)
        : await setLeadNote(lead.id, details);
      onSaved(savedNote);
      setStatus('success');
      setStatusMessage(note ? 'Follow-up note updated.' : 'Follow-up note added.');
    } catch (cause) {
      setStatus('error');
      setStatusMessage(getErrorMessage(cause, 'Could not save the follow-up note'));
    }
  };

  return (
    <Modal
      isOpen={lead !== null}
      onClose={onClose}
      title={note ? 'Edit Follow-up Note' : 'Add Follow-up Note'}
      status={status}
      statusMessage={statusMessage}
      successDelay={900}
      footer={<ModalFormFooter formId="lead-note-form" submitLabel={note ? 'Save' : 'Add Note'} submitStatus={status} onClose={onClose} />}
    >
      <form id="lead-note-form" onSubmit={(event) => void submit(event)}>
        <FormField id="lead-note-details" label="Follow-up note *">
          <textarea id="lead-note-details" name="details" rows={5} maxLength={5000} defaultValue={note?.details ?? ''} required />
        </FormField>
      </form>
    </Modal>
  );
}
