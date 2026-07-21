import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { outreachFormDefaultValues, outreachFormSchema, type OutreachFormValues } from '../../../../common/components/OutreachForm/outreachFormSchema';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { ApiError, getErrorMessage } from '../../../../common/utils/clientErrors';
import { submitExpressionOfInterest } from '../../api/homepage.api';

export function useSignupSection() {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors } } = useForm<OutreachFormValues>({
    resolver: zodResolver(outreachFormSchema),
    defaultValues: outreachFormDefaultValues,
  });
  const isFormLocked = submitStatus === 'submitting' || submitStatus === 'success';

  useEffect(() => {
    if (submitStatus !== 'success') return;
    const timeoutId = window.setTimeout(resetStatus, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [submitStatus, resetStatus]);

  const onValid = async (data: OutreachFormValues) => {
    setError('');
    setSubmitStatus('submitting');
    try {
      await submitExpressionOfInterest({
        youthFirstName: data.youthFirstName.trim(),
        youthLastName: data.youthLastName.trim(),
        age: data.age,
        school: data.school.trim(),
        contactFirstName: data.contactFirstName.trim(),
        contactLastName: data.contactLastName.trim(),
        contactPhoneNumber: data.contactPhoneNumber.trim(),
        contactRelationship: data.contactRelationship,
        discoverySource: data.discoverySource,
        notes: data.notes.trim() || undefined,
      });
      reset(outreachFormDefaultValues);
      setSubmitStatus('success');
    } catch (err) {
      if (err instanceof ApiError) {
        for (const detail of err.details ?? []) {
          const field = detail.field.replace(/^body\./, '') as keyof OutreachFormValues;
          setFieldError(field, { message: detail.message });
        }
      }
      setSubmitStatus('error');
      setError(getErrorMessage(err, 'Unable to submit the form right now.'));
    }
  };

  return { register, errors, handleSubmit, onValid, submitStatus, error, isFormLocked };
}
