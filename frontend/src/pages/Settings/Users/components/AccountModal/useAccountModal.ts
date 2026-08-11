import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteAccount, updateAccount } from '../../api/accounts.api';
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
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AccountFormData>({ resolver: zodResolver(accountSchema), defaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(account ? {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      role: account.role === 'admin' ? 'admin' : 'staff',
      programIds: account.programIds ?? [],
    } : defaultValues);
    resetStatus();
  }, [account, isOpen, reset, resetStatus]);

  const handleClose = () => {
    reset(defaultValues);
    resetStatus();
    onClose();
  };

  const onValid = async (data: AccountFormData) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const payload = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        role: data.role,
        programIds: data.role === 'staff' ? data.programIds : [],
      };
      const result = account
        ? await updateAccount({ id: account.id, ...payload })
        : await inviteAccount(payload);
      setSubmitStatus('success');
      setTimeout(() => {
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
    selectedRole: watch('role'),
  };
}
