import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteAccount, updateAccount } from '../../accounts.api';
import { getErrorMessage } from '../../../../../http/errors';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import type { User } from '../../types';
import { accountSchema, type AccountFormData } from './accountSchema';

const defaultValues: AccountFormData = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'staff',
  programIds: [],
};

interface AccountModalControllerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: User) => void;
  account?: User;
}

/**
 * Initializes and submits an account invitation or edit form.
 * @param props.isOpen - Whether the form is currently open.
 * @param props.account - Saved account to edit; omit it to invite a new account.
 * @param props.onClose - Called after clearing the form when it closes.
 * @param props.onSuccess - Receives the account returned by the server after saving.
 * @returns Form fields, validation messages, and save status.
 * @example useAccountModal({ isOpen: true, onClose, onSuccess }) // invitation form
 */
export function useAccountModal({ isOpen, onClose, onSuccess, account }: AccountModalControllerProps) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountFormData>({ resolver: zodResolver(accountSchema), defaultValues });

  /**
   * Clears the form and save status, then tells the parent to close it.
   * @example handleClose() // resets the form and calls onClose
   */
  const handleClose = useCallback(() => {
    reset(defaultValues);
    resetStatus();
    unlock();
    onClose();
  }, [onClose, reset, resetStatus, unlock]);

  useEffect(() => {
    if (!isOpen) return;
    reset(account ? {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      role: accountSchema.shape.role.parse(account.role),
      programIds: account.programIds,
    } : defaultValues);
    resetStatus();
    unlock();
  }, [account, isOpen, reset, resetStatus, unlock]);

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
    handleClose,
  };
}
