import { type FormEvent } from 'react';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramCycle } from '../../../../../common/types/cohort';
import useCycleModal from './hooks/useCycleModal';

interface CycleModalProps {
  isOpen: boolean;
  cycle: ProgramCycle | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function CycleModal({ isOpen, cycle, onClose, onSaved }: CycleModalProps) {
  const workflow = useCycleModal({ isOpen, cycle, onSaved });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await workflow.submit({
      name: String(form.get('name')),
      startsOn: String(form.get('startsOn')),
      endsOn: String(form.get('endsOn')),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cycle ? 'Edit Cycle' : 'Add Cycle'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1200}
      footer={<ModalFormFooter formId="cycle-form" submitLabel={cycle ? 'Save Changes' : 'Add Cycle'} submitStatus={workflow.submitStatus} onClose={onClose} />}
    >
      <form
        key={cycle?.id ?? 'new'}
        id="cycle-form"
        aria-busy={workflow.submissionComplete}
        onSubmit={(event) => void submit(event)}
      >
        <FormField id="cycle-name" label="Cycle name">
          <input id="cycle-name" name="name" required maxLength={120} placeholder="Fall 2026" defaultValue={cycle?.name} disabled={workflow.submissionComplete} />
        </FormField>
        <div className="form-row">
          <FormField id="cycle-start" label="Starts on">
            <input id="cycle-start" name="startsOn" type="date" required defaultValue={cycle?.startsOn} disabled={workflow.submissionComplete} />
          </FormField>
          <FormField id="cycle-end" label="Ends on">
            <input id="cycle-end" name="endsOn" type="date" required defaultValue={cycle?.endsOn} disabled={workflow.submissionComplete} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
