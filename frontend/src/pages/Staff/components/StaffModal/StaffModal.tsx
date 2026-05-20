import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
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
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={handleClose}
        disabled={submitStatus === 'submitting' || submitStatus === 'success'}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="staff-invite-form"
        disabled={submitStatus === 'submitting' || submitStatus === 'success'}
      >
        {submitStatus === 'submitting'
          ? (isEdit ? 'Updating...' : 'Sending...')
          : (isEdit ? 'Update' : 'Send Invite')}
      </Button>
    </>
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
          <div className="form-field">
            <label htmlFor="firstName">First Name *</label>
            <input
              id="firstName"
              type="text"
              {...register('firstName')}
            />
            {errors.firstName && <span className="field-error">{errors.firstName.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="lastName">Last Name *</label>
            <input
              id="lastName"
              type="text"
              {...register('lastName')}
            />
            {errors.lastName && <span className="field-error">{errors.lastName.message}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              {...register('email')}
            />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="role">Role</label>
            <select id="role" {...register('role')}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && <span className="field-error">{errors.role.message}</span>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
