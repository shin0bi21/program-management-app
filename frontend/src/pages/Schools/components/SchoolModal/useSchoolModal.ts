import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setSchool } from '../../api/schools.api';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { schoolSchema, type SchoolFormData } from './schoolSchema';
import type { School } from '../../types';

const defaultValues: SchoolFormData = {
  name: '',
  board: null,
  address: null,
  postalCode: null,
};

interface UseSchoolModalProps {
  isOpen: boolean;
  schoolData?: School;
  onClose: () => void;
  onSuccess: (school: School) => void;
}

export function useSchoolModal({ isOpen, schoolData, onClose, onSuccess }: UseSchoolModalProps) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchoolFormData>({
    resolver: zodResolver(schoolSchema),
    defaultValues,
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (!isOpen || !schoolData) return;
    reset({
      name: schoolData.name,
      board: (schoolData.board as 'catholic' | 'public' | null) ?? null,
      address: schoolData.address ?? null,
      postalCode: schoolData.postalCode ?? null,
    });
  }, [isOpen, schoolData]);

  const resetForm = () => {
    reset(defaultValues);
    resetStatus();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const onValid = async (data: SchoolFormData) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const saved = await setSchool({ ...data, id: schoolData?.id });
      setSubmitStatus('success');
      setTimeout(() => {
        resetForm();
        onSuccess(saved);
      }, 800);
    } catch (err: unknown) {
      setError(getErrorMessage(err, schoolData ? 'Failed to update school' : 'Failed to add school'));
      setSubmitStatus('error');
    }
  };

  return { register, errors, rhfHandleSubmit, onValid, submitStatus, error, handleClose };
}
