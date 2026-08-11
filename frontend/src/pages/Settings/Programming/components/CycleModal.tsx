import { type FormEvent, useEffect, useState } from 'react';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import { createProgramCycle, updateProgramCycle } from '../../../../common/features/programming/api/programming.api';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import type { ProgramCycle } from '../../../../common/types/cohort';
import { getErrorMessage } from '../../../../http/clientErrors';

interface CycleModalProps {
  isOpen: boolean;
  cycle: ProgramCycle | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function CycleModal({ isOpen, cycle, onClose, onSaved }: CycleModalProps) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStatus('idle');
    setStatusMessage('');
  }, [isOpen, cycle]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get('name')),
      startsOn: String(form.get('startsOn')),
      endsOn: String(form.get('endsOn')),
    };
    setStatus('submitting');
    setStatusMessage(cycle ? `Updating ${input.name}...` : `Creating ${input.name}...`);
    try {
      if (cycle) await updateProgramCycle(cycle.id, input);
      else await createProgramCycle(input);
      await onSaved();
      setStatusMessage(cycle ? 'Cycle updated successfully.' : 'Cycle created successfully.');
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save cycle'));
      setStatus('error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cycle ? 'Edit Cycle' : 'Add Cycle'}
      status={status}
      statusMessage={statusMessage}
      successDelay={1200}
      footer={<ModalFormFooter formId="cycle-form" submitLabel={cycle ? 'Save Changes' : 'Add Cycle'} submitStatus={status} onClose={onClose} />}
    >
      <form key={cycle?.id ?? 'new'} id="cycle-form" onSubmit={(event) => void submit(event)}>
        <FormField id="cycle-name" label="Cycle name">
          <input id="cycle-name" name="name" required maxLength={120} placeholder="Fall 2026" defaultValue={cycle?.name} />
        </FormField>
        <div className="form-row">
          <FormField id="cycle-start" label="Starts on">
            <input id="cycle-start" name="startsOn" type="date" required defaultValue={cycle?.startsOn} />
          </FormField>
          <FormField id="cycle-end" label="Ends on">
            <input id="cycle-end" name="endsOn" type="date" required defaultValue={cycle?.endsOn} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
