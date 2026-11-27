import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setYouth, setYouthContacts } from '../../../youth.api';
import { getErrorMessage } from '../../../../../http/errors';
import { useContacts } from '../../../../../common/features/contacts/hooks/useContacts';
import { useSchoolReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import { youthSchema, youthContactSchema, type YouthFormData } from '../youthSchema';
import type { YouthProfile } from '../../../types';

interface UseYouthModalProps {
  youthData?: YouthProfile;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
  inviteYouth?: boolean;
  mode?: 'full' | 'contact';
}

/**
 * Manages the Youth form and saves either the whole profile or just its contacts.
 * @param props.youthData - Saved profile to edit; omit it to create a new profile.
 * @param props.onClose - Closes the form; the caller unmounts it to discard the draft.
 * @param props.onSuccess - Receives the profile returned by the server after saving.
 * @param props.inviteYouth - Whether to include the entered email when saving the profile.
 * @param props.mode - Use 'contact' to save only contacts; 'full' saves the profile and its addresses and contacts.
 * @returns Form fields, editable addresses and contacts, validation messages, and save status.
 * @example useYouthModal({ onClose, onSuccess }) // new profile form
 */
export function useYouthModal({ youthData, onClose, onSuccess, inviteYouth = false, mode = 'full' }: UseYouthModalProps) {
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<YouthFormData>({
    resolver: zodResolver(mode === 'contact' ? youthContactSchema : youthSchema),
    defaultValues: {
      firstName: youthData?.firstName ?? '',
      lastName: youthData?.lastName ?? '',
      dateOfBirth: youthData?.dateOfBirth ?? '',
      email: youthData?.account?.email ?? '',
      schoolId: youthData?.schoolId ?? '',
      addresses: youthData?.addresses?.length ? youthData.addresses : [{ address: '' }],
    },
  });

  const { data: schools = [], isLoading: schoolsLoading, error: schoolError } = useSchoolReferences();
  const schoolsError = schoolError ? getErrorMessage(schoolError, 'Could not load schools') : '';
  const schoolId = watch('schoolId');

  const addresses = watch('addresses') ?? [];

  const contactForm = useContacts(youthData?.contacts);

  /**
   * Saves the form and reports the profile returned by the server.
   * @param data - Validated profile fields; contact mode saves the separate contact list instead.
   * @example onValid(data) // calls onSuccess with the saved profile
   */
  const onValid = async (data: YouthFormData) => {
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setError('');

    const contactError = contactForm.validate();
    if (contactError) {
      setError(contactError);
      setSubmitStatus('error');
      unlock();
      return;
    }

    let savedYouth: YouthProfile;
    try {
      if (mode === 'contact') {
        if (!youthData) throw new Error('Select a youth profile to update contacts.');
        savedYouth = await setYouthContacts(youthData.id, contactForm.getPayload());
      } else {
        const payload = {
          ...(youthData && { id: youthData.id }),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          ...(inviteYouth && data.email && { email: data.email.trim() }),
          dateOfBirth: data.dateOfBirth || null,
          ...(data.schoolId && { schoolId: data.schoolId }),
          addresses: (data.addresses ?? [])
            .filter(address => address.address)
            .map(address => ({
              ...(address.id && { id: address.id }),
              address: address.address,
            })),
          contacts: contactForm.getPayload(),
        };

        savedYouth = await setYouth(payload);
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, youthData ? 'Failed to update youth profile' : 'Failed to create youth profile'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    setSubmitStatus('success');
    onSuccess(savedYouth);
  };

  return {
    // Profile form fields and submission.
    register,
    errors,
    rhfHandleSubmit,
    onValid,
    // School, address, and contact fields.
    schools,
    schoolsLoading,
    schoolsError,
    schoolId,
    setSchoolId: (id: string) => setValue('schoolId', id, { shouldDirty: true }),
    addresses,
    contacts: contactForm.draft,
    handleContactChange: contactForm.handleChange,
    // Submit state
    submitStatus,
    error,
    // Actions
    handleClose: onClose,
  };
}
