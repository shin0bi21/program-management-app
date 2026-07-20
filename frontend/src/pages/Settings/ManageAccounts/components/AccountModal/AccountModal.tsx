import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/ModalFormFooter/ModalFormFooter';
import type { Account } from '../../../../../common/types/account';
import { useAccountModal } from './useAccountModal';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: Account) => void;
  account?: Account;
}

export default function AccountModal(props: AccountModalProps) {
  const { account } = props;
  const { register, errors, onSubmit, submitStatus, error, handleClose } = useAccountModal(props);
  const isEdit = !!account;

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Account' : 'Invite Staff Account'}
      status={submitStatus}
      statusMessage={
        submitStatus === 'submitting' ? (isEdit ? 'Updating account...' : 'Sending invitation...') :
        submitStatus === 'success' ? (isEdit ? 'Account updated!' : 'Invitation sent!') :
        submitStatus === 'error' ? error : undefined
      }
      footer={<ModalFormFooter formId="account-form" submitLabel={isEdit ? 'Update' : 'Send Invite'} submitStatus={submitStatus} onClose={handleClose} />}
    >
      <form id="account-form" onSubmit={onSubmit}>
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
