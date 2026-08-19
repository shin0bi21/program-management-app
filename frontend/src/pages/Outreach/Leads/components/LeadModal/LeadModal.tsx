import { Controller } from 'react-hook-form';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import OutreachFormFields from '../../../../../common/features/outreach/components/OutreachForm/OutreachFormFields';
import ProgramSelect from '../../../../../common/features/programs/components/ProgramSelect/ProgramSelect';
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
          programField={
            <FormField id="lead-programId" label="Program of Interest" error={errors.programId?.message}>
              <Controller
                name="programId"
                control={control}
                render={({ field }) => (
                  <ProgramSelect
                    id="lead-programId"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          }
        />
      </form>
    </Modal>
  );
}
