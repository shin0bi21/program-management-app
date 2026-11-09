import { Controller } from 'react-hook-form';
import Checklist from '../../../../../common/components/Checklist/Checklist';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import FormFieldGroup from '../../../../../common/components/FormField/FormFieldGroup';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { User } from '../../types';
import { useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { useAccountModal } from './useAccountModal';
import './AccountModal.css';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: User) => void;
  account?: User;
}

/**
 * Mounts a fresh staff-account editor for each open target.
 * @param props - Visibility, supplied account values, and completion actions.
 * @example <AccountModal isOpen account={account} onClose={close} onSuccess={sync} />
 */
export default function AccountModal({ isOpen, ...props }: AccountModalProps) {
  return isOpen ? <AccountForm key={props.account?.id ?? 'new'} {...props} /> : null;
}

/**
 * Owns staff-account fields and selector choices until close or save completion.
 * @param props - Optional saved non-youth account and close/save actions.
 * @example <AccountForm onClose={close} onSuccess={sync} />
 */
function AccountForm({ account, onClose, onSuccess }: Omit<AccountModalProps, 'isOpen'>) {
  const { rows: programs, loading: programsLoading } = useProgramReferences();
  const { register, control, errors, onSubmit, submitStatus, error } = useAccountModal({ account, onSuccess });
  const isEdit = account !== undefined;
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  let statusMessage: string | undefined;
  if (submitStatus === 'submitting') {
    statusMessage = isEdit ? 'Updating account...' : 'Sending invitation...';
  } else if (submitStatus === 'success') {
    statusMessage = isEdit ? 'Account updated!' : 'Invitation sent!';
  } else if (submitStatus === 'error') {
    statusMessage = error;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Account' : 'Invite Staff Account'}
      status={submitStatus}
      statusMessage={statusMessage}
      footer={<ModalFormFooter formId="account-form" submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id="account-form" onSubmit={onSubmit}>
        <div className="form-row">
          <FormField id="firstName" label="First Name *" error={errors.firstName?.message}>
            <input id="firstName" type="text" disabled={submissionComplete} {...register('firstName')} />
          </FormField>
          <FormField id="lastName" label="Last Name *" error={errors.lastName?.message}>
            <input id="lastName" type="text" disabled={submissionComplete} {...register('lastName')} />
          </FormField>
        </div>
        <div className="form-row">
          <FormField id="email" label="Email *" error={errors.email?.message}>
            <input id="email" type="email" disabled={submissionComplete} {...register('email')} />
          </FormField>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <FormField id="role" label="Role" error={errors.role?.message}>
                <FloatingSelect
                  id="role"
                  ariaLabel="Role"
                  value={field.value ?? ''}
                  options={[
                    { value: 'staff', label: 'Staff' },
                    { value: 'project_manager', label: 'Project Manager' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  onChange={field.onChange}
                  disabled={submissionComplete}
                />
              </FormField>
            )}
          />
        </div>
        <FormFieldGroup label="Programs">
          {programsLoading && (
            <span className="account-programs__empty">Loading programs…</span>
          )}
          {!programsLoading && programs.length === 0 && (
            <span className="account-programs__empty">No assignable programs.</span>
          )}
          {!programsLoading && programs.length > 0 && (
            <Controller
              name="programIds"
              control={control}
              render={({ field }) => (
                <Checklist
                  variant="form"
                  ariaLabel="Programs"
                  options={programs.map(program => ({ value: program.id, label: program.name }))}
                  value={field.value}
                  onToggle={value => field.onChange(field.value.includes(value)
                    ? field.value.filter(id => id !== value)
                    : [...field.value, value])}
                  disabled={submissionComplete}
                />
              )}
            />
          )}
        </FormFieldGroup>
      </form>
    </Modal>
  );
}
