import { type FormEvent, useEffect, useState } from 'react';
import { createCohort } from '../../../../../common/api/cohorts.api';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { Program } from '../../../../../features/programs/types';
import { getErrorMessage } from '../../../../../common/utils/clientErrors';

interface AddCohortModalProps {
  isOpen: boolean;
  programs: Program[];
  initialProgramId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

export default function AddCohortModal({
  isOpen,
  programs,
  initialProgramId,
  onClose,
  onCreated,
}: AddCohortModalProps) {
  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setProgramId(initialProgramId || programs[0]?.id || '');
    setStatus('idle');
    setStatusMessage('');
  }, [initialProgramId, isOpen, programs]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name'));
    const programName = programs.find((program) => program.id === programId)?.name ?? 'program';
    setStatus('submitting');
    setStatusMessage(`Adding ${name} to ${programName}...`);
    try {
      await createCohort({
        programId,
        name,
        startsOn: String(form.get('startsOn')),
        endsOn: String(form.get('endsOn')),
      });
      await onCreated();
      setStatusMessage(`${name} successfully added to ${programName}.`);
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not create cohort'));
      setStatus('error');
    }
  };

  const complete = status === 'submitting' || status === 'success';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add cohort"
      status={status}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={complete}
      footer={(
        <ModalFormFooter
          formId="add-cohort-form"
          submitLabel="Add Cohort"
          submitStatus={status}
          onClose={onClose}
        />
      )}
    >
      <form id="add-cohort-form" onSubmit={(event) => void submit(event)}>
        <FormField id="cohort-program" label="Program">
          <FloatingSelect
            id="cohort-program"
            value={programId}
            options={programs.map((program) => ({ value: program.id, label: program.name }))}
            onChange={setProgramId}
            placeholder="Choose a program"
          />
        </FormField>
        <FormField id="cohort-name" label="Cohort name">
          <input id="cohort-name" name="name" required maxLength={120} placeholder="Fall 2026" />
        </FormField>
        <div className="form-row">
          <FormField id="cohort-start" label="Starts on">
            <input id="cohort-start" name="startsOn" type="date" required />
          </FormField>
          <FormField id="cohort-end" label="Ends on">
            <input id="cohort-end" name="endsOn" type="date" required />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
