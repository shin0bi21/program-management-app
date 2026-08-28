import FormField from '../../../../../components/FormField/FormField';
import Modal from '../../../../../components/Modal/Modal';
import ModalFormFooter from '../../../../../components/Modal/components/ModalFormFooter';
import type { Program } from '../../../types';
import useAddProgramModal from './hooks/useAddProgramModal';

interface AddProgramModalProps {
  isOpen: boolean;
  programsError: string;
  onClose: () => void;
  onCreated: (program: Program) => void;
}

export default function AddProgramModal({
  isOpen,
  programsError,
  onClose,
  onCreated,
}: AddProgramModalProps) {
  const workflow = useAddProgramModal({ isOpen, onCreated });

  const close = () => {
    onClose();
    workflow.resetStatus();
  };

  const footer = (
    <ModalFormFooter
      formId="add-program-form"
      submitLabel="Add Program"
      submitStatus={workflow.submitStatus}
      onClose={close}
    />
  );
  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Add Program"
      status={workflow.submitStatus}
      successDelay={500}
      statusMessage={workflow.statusMessage}
      footer={footer}
    >
      <form id="add-program-form" onSubmit={workflow.submit} noValidate>
        <FormField
          id="new-program-name"
          label="Program Name *"
          error={workflow.errors.name?.message || programsError || undefined}
        >
          <input id="new-program-name" autoFocus disabled={workflow.submissionComplete} {...workflow.register('name')} />
        </FormField>
      </form>
    </Modal>
  );
}
