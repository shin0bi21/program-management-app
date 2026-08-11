import { type FormEvent, useEffect, useState } from 'react';
import { updateCohort } from '../../../../../common/features/programming/api/programming.api';
import FormField from '../../../../../common/components/FormField/FormField';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { ProgramCohort, ProgramCycle } from '../../../../../common/types/cohort';
import { getErrorMessage } from '../../../../../http/clientErrors';

interface EditCohortModalProps {
  cohort: ProgramCohort | null;
  cycles: ProgramCycle[];
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export default function EditCohortModal({ cohort, cycles, onClose, onUpdated }: EditCohortModalProps) {
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!cohort) return;
    setCycleId(cohort.cycleId);
    setStatus('idle');
    setStatusMessage('');
  }, [cohort]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cohort) return;
    setStatus('submitting');
    setStatusMessage('Updating cohort...');
    try {
      await updateCohort(cohort.id, {
        cycleId,
      });
      await onUpdated();
      setStatusMessage('Cohort updated successfully.');
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not update cohort'));
      setStatus('error');
    }
  };

  return (
    <Modal
      isOpen={cohort !== null}
      onClose={onClose}
      title="Edit Cohort"
      status={status}
      statusMessage={statusMessage}
      successDelay={1200}
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
          <FormField id="edit-cohort-cycle" label="Cycle">
            <FloatingSelect
              id="edit-cohort-cycle"
              value={cycleId}
              options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
              onChange={setCycleId}
              placeholder="Choose a cycle"
            />
          </FormField>
        </form>
      )}
    </Modal>
  );
}
