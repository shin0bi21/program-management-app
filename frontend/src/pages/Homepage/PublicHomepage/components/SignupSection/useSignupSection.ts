import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { publicOutreachFormSchema, type PublicOutreachFormValues } from '../../../../../common/features/OutreachForm/outreachFormSchema';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { ApiError, getErrorMessage } from '../../../../../http/errors';
import { submitPublicLead } from '../../publicHomepage.api';

/**
 * Saves one mounted public intake draft, preserving rejected values for correction.
 * @param onSuccess - Ends this form instance after the server accepts the submission.
 * @example useSignupSection(showFeedback) // starts with blank fields and unselected choices
 */
export function useSignupSection(onSuccess: () => void) {
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();
  const { register, control, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<PublicOutreachFormValues>({
    resolver: zodResolver(publicOutreachFormSchema),
    defaultValues: {
      youthFirstName: '',
      youthLastName: '',
      dateOfBirth: '',
      school: '',
      contactPhoneNumber: '',
      submittedByRole: undefined,
      contactRelationship: undefined,
      discoverySource: undefined,
      notes: '',
      website: '',
    },
  });
  const isFormLocked = submitStatus === 'submitting';

  /**
   * Submits validated intake fields once, reporting server validation errors for correction.
   * @param data - Validated signup values; surrounding text spaces are removed for the command.
   * @example onValid(data) // calls onSuccess after the signup is accepted
   */
  const onValid = async (data: PublicOutreachFormValues) => {
    if (!tryLock()) return;

    setError('');
    setSubmitStatus('submitting');
    try {
      await submitPublicLead({
        youthFirstName: data.youthFirstName.trim(),
        youthLastName: data.youthLastName.trim(),
        dateOfBirth: data.dateOfBirth,
        school: data.school.trim(),
        submittedByRole: data.submittedByRole,
        contactPhoneNumber: data.contactPhoneNumber.trim(),
        contactRelationship: data.contactRelationship,
        discoverySource: data.discoverySource,
        notes: data.notes.trim() || undefined,
        website: '',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        for (const detail of err.details ?? []) {
          const field = publicOutreachFormSchema.keyof().safeParse(detail.field.replace(/^body\./, ''));
          if (field.success) setFieldError(field.data, { message: detail.message });
        }
      }
      setSubmitStatus('error');
      setError(getErrorMessage(err, 'Unable to submit the form right now.'));
      unlock();
      return;
    }

    onSuccess();
  };

  return { register, control, errors, handleSubmit, onValid, submitStatus, error, isFormLocked };
}
