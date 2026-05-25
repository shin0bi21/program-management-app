import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteStaff, updateStaff } from '../../../../common/api/staff.api';
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
  staffData?: StaffUser;
}

export function useStaffModal({ isOpen, onClose, onSuccess, staffData }: UseStaffModalProps) {
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
    if (staffData) {
      reset({
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        email: staffData.email,
        role: staffData.role,
      });
    } else {
      reset(defaultValues);
    }
    resetStatus();
  }, [isOpen, staffData]);

  const handleClose = () => {
    reset(defaultValues);
    resetStatus();
    onClose();
  };

  const onValid = async (data: StaffFormData) => {
    setSubmitStatus('submitting');
    setError('');

    try {
      const result = staffData
        ? await updateStaff({
            id: staffData.id,
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            email: data.email.trim(),
            role: data.role,
          })
        : await inviteStaff({
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            email: data.email.trim(),
            role: data.role,
          });

      setSubmitStatus('success');
      setTimeout(() => {
        onSuccess(result);
        handleClose();
      }, 1000);
    } catch (err) {
      setError(getErrorMessage(err, staffData ? 'Failed to update staff' : 'Failed to send invite'));
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
