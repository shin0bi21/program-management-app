import { Controller } from 'react-hook-form';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { Account } from '../../../../../common/types/account';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';
import { useAccountModal } from './useAccountModal';
import './AccountModal.css';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: Account) => void;
  account?: Account;
}

export default function AccountModal(props: AccountModalProps) {
  const { account } = props;
  const { programs, loading: programsLoading } = usePrograms();
  const { register, control, errors, onSubmit, submitStatus, error, handleClose, selectedRole } = useAccountModal(props);
  const isEdit = account !== undefined;
  const assignablePrograms = programs.filter(program => program.rosterMode === 'enrolled');
  const openPrograms = programs.filter(program => program.rosterMode === 'open');

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
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <FloatingSelect
                  id="role"
                  ariaLabel="Role"
                  value={field.value}
                  options={[
                    { value: 'staff', label: 'Staff' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  onChange={field.onChange}
                  disabled={submitStatus === 'submitting' || submitStatus === 'success'}
                />
              )}
            />
          </FormField>
        </div>
        {selectedRole === 'staff' && (
          <fieldset className="account-programs">
            <legend>Programs</legend>
            <div className="account-programs__list">
              {programsLoading ? (
                <span className="account-programs__empty">Loading programs…</span>
              ) : assignablePrograms.length ? assignablePrograms.map(program => (
                <label key={program.id} className="account-programs__option">
                  <input type="checkbox" value={program.id} {...register('programIds')} />
                  <span>{program.name}</span>
                </label>
              )) : (
                <span className="account-programs__empty">No assignable programs.</span>
              )}
            </div>
            {openPrograms.length > 0 && (
              <small>
                Automatically available: {openPrograms.map(program => program.name).join(', ')}
              </small>
            )}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
