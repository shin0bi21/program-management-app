import { type FormEvent, useEffect, useState } from 'react';
import { createCohort } from '../../../../../common/features/programming/api/programming.api';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../../common/types/cohort';
import { getErrorMessage } from '../../../../../http/clientErrors';

interface AddCohortModalProps {
  isOpen: boolean;
  programs: Program[];
  cycles: ProgramCycle[];
  initialProgramId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

export default function AddCohortModal({
  isOpen,
  programs,
  cycles,
  initialProgramId,
  onClose,
  onCreated,
}: AddCohortModalProps) {
  const [programId, setProgramId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setProgramId(initialProgramId || programs[0]?.id || '');
    setCycleId(cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? '');
    setStatus('idle');
    setStatusMessage('');
  }, [cycles, initialProgramId, isOpen, programs]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cycleName = cycles.find(cycle => cycle.id === cycleId)?.name ?? 'cycle';
    const programName = programs.find((program) => program.id === programId)?.name ?? 'program';
    setStatus('submitting');
    setStatusMessage(`Adding ${programName} to ${cycleName}...`);
    try {
      await createCohort({
        programId,
        cycleId,
      });
      await onCreated();
      setStatusMessage(`${programName} successfully added to ${cycleName}.`);
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not create cohort'));
      setStatus('error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add cohort"
      status={status}
      statusMessage={statusMessage}
      successDelay={1400}
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
        <FormField id="cohort-cycle" label="Cycle">
          <FloatingSelect
            id="cohort-cycle"
            value={cycleId}
            options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
            onChange={setCycleId}
            placeholder="Choose a cycle"
          />
        </FormField>
      </form>
    </Modal>
  );
}
