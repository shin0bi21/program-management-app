import { useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteAccount, updateAccount } from '../../accounts.api';
import { getErrorMessage } from '../../../../../http/clientErrors';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { Account } from '../../../../../common/types/account';
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
  onSuccess: (account: Account) => void;
  account?: Account;
}

export function useAccountModal({ isOpen, onClose, onSuccess, account }: AccountModalControllerProps) {
  const completionTimerRef = useRef<number | null>(null);
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountFormData>({ resolver: zodResolver(accountSchema), defaultValues });

  const clearCompletionTimer = useCallback(() => {
    if (completionTimerRef.current === null) return;
    window.clearTimeout(completionTimerRef.current);
    completionTimerRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    clearCompletionTimer();
    reset(defaultValues);
    resetStatus();
    onClose();
  }, [clearCompletionTimer, onClose, reset, resetStatus]);

  useEffect(() => {
    clearCompletionTimer();
    if (!isOpen) return;
    reset(account ? {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      role: account.role === 'admin' ? 'admin' : 'staff',
      programIds: account.programIds ?? [],
    } : defaultValues);
    resetStatus();
    return clearCompletionTimer;
  }, [account, clearCompletionTimer, isOpen, reset, resetStatus]);

  const onValid = async (data: AccountFormData) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const payload = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        role: data.role,
        programIds: data.programIds,
      };
      const result = account
        ? await updateAccount({ id: account.id, ...payload })
        : await inviteAccount(payload);
      setSubmitStatus('success');
      completionTimerRef.current = window.setTimeout(() => {
        completionTimerRef.current = null;
        onSuccess(result);
        handleClose();
      }, 800);
    } catch (err) {
      setError(getErrorMessage(err, account ? 'Failed to update account' : 'Failed to send invitation'));
      setSubmitStatus('error');
    }
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
