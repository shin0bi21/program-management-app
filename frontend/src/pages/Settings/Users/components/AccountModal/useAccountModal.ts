import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteAccount, updateAccount } from '../../accounts.api';
import { getErrorMessage } from '../../../../../http/errors';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import type { User } from '../../types';
import { accountSchema, type AccountFormData } from './accountSchema';

interface AccountModalControllerProps {
  onSuccess: (account: User) => void;
  account?: User;
}

/**
 * Initializes one mounted account invitation or edit form and saves validated fields.
 * @param props.account - Saved non-youth account to edit; omit it to invite staff.
 * @param props.onSuccess - Receives the authoritative account returned after saving.
 * @returns Form controls, validation messages, and submission feedback.
 * @example useAccountModal({ account, onSuccess }) // edits the supplied staff account
 */
export function useAccountModal({ onSuccess, account }: AccountModalControllerProps) {
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      firstName: account?.firstName ?? '',
      lastName: account?.lastName ?? '',
      email: account?.email ?? '',
      role: account ? accountSchema.shape.role.parse(account.role) : undefined,
      programIds: account?.programIds ?? [],
    },
  });

  /**
   * Saves the form and reports the account returned by the server.
   * @param data - Validated name, email, role, and selected program IDs from the form.
   * @example onValid(data) // calls onSuccess after an invitation or update
   */
  const onValid = async (data: AccountFormData) => {
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setError('');

    let savedAccount: User;
    try {
      const payload = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        role: data.role,
        programIds: data.programIds,
      };
      savedAccount = account
        ? await updateAccount({ id: account.id, ...payload })
        : await inviteAccount(payload);
    } catch (error) {
      setError(getErrorMessage(error, account ? 'Failed to update account' : 'Failed to send invitation'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    setSubmitStatus('success');
    onSuccess(savedAccount);
  };

  return {
    register,
    control,
    errors,
    onSubmit: handleSubmit(onValid),
    submitStatus,
    error,
  };
}
