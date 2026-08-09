import { type FormEvent, useEffect, useState } from 'react';
import { updateCohort } from '../../../../../common/features/programming/api/programming.api';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import { getErrorMessage } from '../../../../../http/clientErrors';

interface EditCohortModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export default function EditCohortModal({ cohort, onClose, onUpdated }: EditCohortModalProps) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!cohort) return;
    setStatus('idle');
    setStatusMessage('');
  }, [cohort]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cohort) return;
    const form = new FormData(event.currentTarget);
    setStatus('submitting');
    setStatusMessage('Updating cohort...');
    try {
      await updateCohort(cohort.id, {
        name: String(form.get('name')),
        startsOn: String(form.get('startsOn')),
        endsOn: String(form.get('endsOn')),
      });
      await onUpdated();
      setStatusMessage('Cohort updated successfully.');
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not update cohort'));
      setStatus('error');
    }
  };

  const complete = status === 'submitting' || status === 'success';

  return (
    <Modal
      isOpen={cohort !== null}
      onClose={onClose}
      title="Edit cohort"
      status={status}
      statusMessage={statusMessage}
      successDelay={1200}
      disableClose={complete}
      footer={(
        <ModalFormFooter
          formId="edit-cohort-form"
          submitLabel="Save Changes"
          submitStatus={status}
          onClose={onClose}
        />
      )}
    >
      {cohort && (
        <form id="edit-cohort-form" onSubmit={(event) => void submit(event)}>
          <FormField id="edit-cohort-name" label="Cohort name">
            <input id="edit-cohort-name" name="name" required maxLength={120} defaultValue={cohort.name} />
          </FormField>
          <div className="form-row">
            <FormField id="edit-cohort-start" label="Starts on">
              <input id="edit-cohort-start" name="startsOn" type="date" required defaultValue={cohort.startsOn} />
            </FormField>
            <FormField id="edit-cohort-end" label="Ends on">
              <input id="edit-cohort-end" name="endsOn" type="date" required defaultValue={cohort.endsOn} />
            </FormField>
          </div>
        </form>
      )}
    </Modal>
  );
}
