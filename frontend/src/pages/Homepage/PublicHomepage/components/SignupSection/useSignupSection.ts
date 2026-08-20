import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { publicOutreachFormDefaultValues, publicOutreachFormSchema, type PublicOutreachFormValues } from '../../../../../common/features/outreach/components/OutreachForm/outreachFormSchema';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { ApiError, getErrorMessage } from '../../../../../http/clientErrors';
import { submitPublicLead } from '../../publicHomepage.api';

export function useSignupSection() {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { register, control, handleSubmit, reset, setError: setFieldError, formState: { errors } } = useForm<PublicOutreachFormValues>({
    resolver: zodResolver(publicOutreachFormSchema),
    defaultValues: publicOutreachFormDefaultValues,
  });
  const isFormLocked = submitStatus === 'submitting' || submitStatus === 'success';

  useEffect(() => {
    if (submitStatus !== 'success') return;
    const timeoutId = window.setTimeout(resetStatus, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [submitStatus, resetStatus]);

  const onValid = async (data: PublicOutreachFormValues) => {
    setError('');
    setSubmitStatus('submitting');
    try {
      await submitPublicLead({
        youthFirstName: data.youthFirstName.trim(),
        youthLastName: data.youthLastName.trim(),
        age: data.age,
        school: data.school.trim(),
        submittedByRole: data.submittedByRole,
        contactPhoneNumber: data.contactPhoneNumber.trim(),
        contactRelationship: data.contactRelationship,
        discoverySource: data.discoverySource,
        notes: data.notes.trim() || undefined,
        website: '',
      });
      reset(publicOutreachFormDefaultValues);
      setSubmitStatus('success');
    } catch (err) {
      if (err instanceof ApiError) {
        for (const detail of err.details ?? []) {
          const field = detail.field.replace(/^body\./, '') as keyof PublicOutreachFormValues;
          setFieldError(field, { message: detail.message });
        }
      }
      setSubmitStatus('error');
      setError(getErrorMessage(err, 'Unable to submit the form right now.'));
    }
  };

  return { register, control, errors, handleSubmit, onValid, submitStatus, error, isFormLocked };
}
