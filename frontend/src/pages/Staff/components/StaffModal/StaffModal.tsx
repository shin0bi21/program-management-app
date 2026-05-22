import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
import { useStaffModal } from './useStaffModal';
import type { StaffUser } from '../../types';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staff: StaffUser) => void;
  staffData?: StaffUser;
}

export default function StaffModal({ isOpen, onClose, onSuccess, staffData }: StaffModalProps) {
  const {
    register,
    errors,
    onSubmit,
    submitStatus,
    error,
    handleClose,
  } = useStaffModal({ isOpen, onClose, onSuccess, staffData });

  const isEdit = !!staffData;

  const footer = (
    <ModalFormFooter
      formId="staff-invite-form"
      submitLabel={isEdit ? 'Update' : 'Send Invite'}
      submitStatus={submitStatus}
      onClose={handleClose}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Staff Member' : 'Invite Staff Member'}
      footer={footer}
      status={submitStatus}
      statusMessage={
        submitStatus === 'submitting' ? (isEdit ? 'Updating...' : 'Sending invite...') :
        submitStatus === 'success' ? (isEdit ? 'Updated successfully!' : 'Invite sent successfully!') :
        submitStatus === 'error' ? error :
        undefined
      }
    >
      <form id="staff-invite-form" onSubmit={onSubmit}>
        <div className="form-row">
          <FormField id="firstName" label="First Name *" error={errors.firstName?.message}>
            <input id="firstName" type="text" {...register('firstName')} />
          </FormField>
          <FormField id="lastName" label="Last Name *" error={errors.lastName?.message}>
            <input id="lastName" type="text" {...register('lastName')} />
          </FormField>
        </div>

        <div className="form-row">
          <FormField id="email" label="Email *" error={errors.email?.message}>
            <input id="email" type="email" {...register('email')} />
          </FormField>
          <FormField id="role" label="Role" error={errors.role?.message}>
            <select id="role" {...register('role')}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
