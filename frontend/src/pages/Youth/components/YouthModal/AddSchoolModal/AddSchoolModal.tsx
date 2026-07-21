import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/ModalFormFooter/ModalFormFooter';
import type { School } from '../../../../../common/types/school';
import { useAddSchoolModal } from './useAddSchoolModal';

interface AddSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (school: School) => void;
}

export default function AddSchoolModal({ isOpen, onClose, onSuccess }: AddSchoolModalProps) {
  const { register, errors, handleSubmit, submit, submitStatus, error, close } = useAddSchoolModal({ isOpen, onClose, onSuccess });

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Add School"
      status={submitStatus}
      statusMessage={
        submitStatus === 'submitting' ? 'Adding school...' :
        submitStatus === 'success' ? 'School added!' :
        submitStatus === 'error' ? error : undefined
      }
      footer={<ModalFormFooter formId="add-school-form" submitLabel="Add School" submitStatus={submitStatus} onClose={close} />}
    >
      <form id="add-school-form" onSubmit={handleSubmit(submit)} noValidate>
        <FormField id="new-school-name" label="School Name *" error={errors.name?.message}>
          <input id="new-school-name" type="text" autoFocus {...register('name')} />
        </FormField>
      </form>
    </Modal>
  );
}
