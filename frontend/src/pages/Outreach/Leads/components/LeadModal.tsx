import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
import OutreachFormFields from '../../../../common/components/OutreachForm/OutreachFormFields';
import type { Lead } from '../types';
import { useLeadModal } from './useLeadModal';

export default function LeadModal({ isOpen, onClose, onSuccess, lead }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}) {
  const isEdit = lead !== undefined;
  const { register, errors, handleSubmit, onValid, submitStatus, error, handleClose } = useLeadModal({ isOpen, onClose, onSuccess, lead });
  const footer = <ModalFormFooter formId="lead-form" submitLabel={isEdit ? 'Update Lead' : 'Create Lead'} submitStatus={submitStatus} onClose={handleClose} />;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEdit ? 'Edit Lead' : 'Create Lead'} footer={footer} status={submitStatus}
      statusMessage={submitStatus === 'submitting' ? (isEdit ? 'Updating lead...' : 'Creating lead...') : submitStatus === 'success' ? (isEdit ? 'Lead updated successfully!' : 'Lead created successfully!') : submitStatus === 'error' ? error : undefined}>
      <form id="lead-form" onSubmit={handleSubmit(onValid)}>
        <OutreachFormFields idPrefix="lead" register={register} errors={errors} />
      </form>
    </Modal>
  );
}
