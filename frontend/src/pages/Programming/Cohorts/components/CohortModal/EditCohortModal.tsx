import FormField from '../../../../../common/components/FormField/FormField';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramCohort, ProgramCycle } from '../../types';

import { useEditCohortModal } from './hooks/useEditCohortModal';

interface EditCohortModalProps {
  cohort: ProgramCohort | null;
  cycles: ProgramCycle[];
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export default function EditCohortModal({ cohort, cycles, onClose, onUpdated }: EditCohortModalProps) {
  const form = useEditCohortModal({ cohort, onUpdated });

  return (
    <Modal
      isOpen={cohort !== null}
      onClose={onClose}
      title="Edit Cohort"
      status={form.status}
      statusMessage={form.statusMessage}
      successDelay={1200}
      footer={(
        <ModalFormFooter
          formId="edit-cohort-form"
          submitLabel="Save Changes"
          submitStatus={form.status}
          onClose={onClose}
        />
      )}
    >
      {cohort && (
        <form id="edit-cohort-form" onSubmit={(event) => void form.submit(event)}>
          <FormField id="edit-cohort-cycle" label="Cycle">
            <FloatingSelect
              id="edit-cohort-cycle"
              value={form.cycleId}
              options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
              onChange={form.setCycleId}
              placeholder="Choose a cycle"
              disabled={form.submissionComplete}
            />
          </FormField>
        </form>
      )}
    </Modal>
  );
}
