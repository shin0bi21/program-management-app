import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import OutreachFormFields from '../../../../common/features/OutreachForm/OutreachFormFields';
import type { Lead } from '../../types';
import { useLeadModal } from './useLeadModal';

export default function LeadModal({ isOpen, onClose, onSuccess, lead }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}) {
  const isEdit = lead !== undefined;
  const {
    register,
    control,
    errors,
    handleSubmit,
    onValid,
    submitStatus,
    error,
    handleClose,
  } = useLeadModal({ isOpen, onClose, onSuccess, lead });
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  let statusMessage: string | undefined;
  if (submitStatus === 'submitting') {
    statusMessage = isEdit ? 'Updating lead...' : 'Creating lead...';
  } else if (submitStatus === 'success') {
    statusMessage = isEdit ? 'Lead updated successfully!' : 'Lead created successfully!';
  } else if (submitStatus === 'error') {
    statusMessage = error;
  }
  const footer = (
    <ModalFormFooter
      formId="lead-form"
      submitLabel={isEdit ? 'Update Lead' : 'Create Lead'}
      submitStatus={submitStatus}
      onClose={handleClose}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Lead' : 'Create Lead'}
      footer={footer}
      status={submitStatus}
      statusMessage={statusMessage}
    >
      <form id="lead-form" onSubmit={handleSubmit(onValid)}>
        <OutreachFormFields
          idPrefix="lead"
          register={register}
          control={control}
          errors={errors}
          disabled={submissionComplete}
        />
      </form>
    </Modal>
  );
}
