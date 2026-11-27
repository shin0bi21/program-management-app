import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setYouth, setYouthContacts } from '../../../youth.api';
import { getErrorMessage } from '../../../../../http/errors';
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
    control,
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
      contacts: youthData?.contacts?.length
        ? youthData.contacts.map(({ id, phoneNumber, type }) => ({ id, phoneNumber: phoneNumber ?? '', type }))
        : [{ id: '', phoneNumber: '', type: 'parent' }],
    },
  });

  const { data: schools = [], isLoading: schoolsLoading, error: schoolError } = useSchoolReferences();
  const schoolsError = schoolError ? getErrorMessage(schoolError, 'Could not load schools') : '';
  const schoolId = watch('schoolId');

  const addresses = watch('addresses') ?? [];

  const { fields: contacts } = useFieldArray({ control, name: 'contacts' });

  /**
   * Saves the form and reports the profile returned by the server.
   * @param data - Validated profile and contact fields. Contact mode saves only the contacts.
   * @example onValid(data) // calls onSuccess with the saved profile
   */
  const onValid = async (data: YouthFormData) => {
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setError('');

    const normalizedContacts = data.contacts.map(contact => ({
      ...contact,
      phoneNumber: contact.phoneNumber.trim(),
    }));
    const missingPhoneIndex = normalizedContacts.findIndex(contact => contact.id && !contact.phoneNumber);
    if (missingPhoneIndex !== -1) {
      setError(`Contact ${missingPhoneIndex + 1}: Phone number is required`);
      setSubmitStatus('error');
      unlock();
      return;
    }

    const contacts = normalizedContacts
      .filter(contact => contact.phoneNumber)
      .map(({ id, phoneNumber, type }) => ({
        ...(id && { id }),
        phoneNumber,
        type,
      }));

    let savedYouth: YouthProfile;
    try {
      if (mode === 'contact') {
        if (!youthData) throw new Error('Select a youth profile to update contacts.');
        savedYouth = await setYouthContacts(youthData.id, contacts);
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
          contacts,
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
    control,
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
    contacts,
    // Submit state
    submitStatus,
    error,
    // Actions
    handleClose: onClose,
  };
}
