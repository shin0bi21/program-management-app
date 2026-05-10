import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteStaff } from '../../api/staff.api';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { staffSchema, type StaffFormData } from './staffSchema';
import type { StaffUser } from '../../types';

const defaultValues: StaffFormData = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'staff',
};

interface UseStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staff: StaffUser) => void;
}

export function useStaffModal({ isOpen, onClose, onSuccess }: UseStaffModalProps) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(defaultValues);
    resetStatus();
  }, [isOpen]);

  const handleClose = () => {
    reset(defaultValues);
    resetStatus();
    onClose();
  };

  const onValid = async (data: StaffFormData) => {
    setSubmitStatus('submitting');
    setError('');

    try {
      const created = await inviteStaff({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        role: data.role,
      });

      setSubmitStatus('success');
      setTimeout(() => {
        onSuccess(created);
        handleClose();
      }, 1000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send invite'));
      setSubmitStatus('error');
    }
  };

  return {
    register,
    errors,
    onSubmit: rhfHandleSubmit(onValid),
    submitStatus,
    error,
    handleClose,
  };
}
