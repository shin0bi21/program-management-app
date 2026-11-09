import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import OutreachFormFields from '../../../../common/features/OutreachForm/OutreachFormFields';
import type { Lead } from '../../types';
import { useLeadModal } from './useLeadModal';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}

/**
 * Mounts a fresh lead editor for the supplied open target.
 * @param props - Visibility, optional saved lead, and close/save actions.
 * @example <LeadModal isOpen lead={lead} onClose={close} onSuccess={sync} />
 */
export default function LeadModal({ isOpen, ...props }: LeadModalProps) {
  return isOpen ? <LeadForm key={props.lead?.id ?? 'new'} {...props} /> : null;
}

/**
 * Edits one supplied lead or an empty intake form until close or save completion.
 * @param props - Initial saved values and completion actions.
 * @example <LeadForm onClose={close} onSuccess={sync} />
 */
function LeadForm({ onClose, onSuccess, lead }: Omit<LeadModalProps, 'isOpen'>) {
  const isEdit = lead !== undefined;
  const {
    register,
    control,
    errors,
    handleSubmit,
    onValid,
    submitStatus,
    error,
  } = useLeadModal({ onSuccess, lead });
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
      submitStatus={submitStatus}
      onClose={onClose}
    />
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
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
