import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSchool } from '../../../../../common/api/schools.api';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../common/utils/clientErrors';
import type { School } from '../../../../../common/types/school';
import { addSchoolSchema, type AddSchoolFormData } from './addSchoolSchema';

const defaultValues: AddSchoolFormData = { name: '' };

export function useAddSchoolModal({ isOpen, onClose, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (school: School) => void;
}) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddSchoolFormData>({
    resolver: zodResolver(addSchoolSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      resetStatus();
    }
  }, [isOpen, reset, resetStatus]);

  const close = () => {
    reset(defaultValues);
    resetStatus();
    onClose();
  };

  const submit = async ({ name }: AddSchoolFormData) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const school = await createSchool(name.trim());
      setSubmitStatus('success');
      window.setTimeout(() => onSuccess(school), 500);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add school'));
      setSubmitStatus('error');
    }
  };

  return { register, errors, handleSubmit, submit, submitStatus, error, close };
}
