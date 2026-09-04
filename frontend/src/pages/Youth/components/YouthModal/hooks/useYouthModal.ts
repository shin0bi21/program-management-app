import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setYouth } from '../../../youth.api';
import { getErrorMessage } from '../../../../../http/errors';
import { useContacts } from '../../../../../common/features/contacts/hooks/useContacts';
import { useAddresses } from './useAddresses';
import { useSchools } from '../../../../../common/features/SchoolModal/hooks/useSchools';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import { youthSchema, type YouthFormData } from '../youthSchema';
import type { YouthProfile } from '../../../types';

const defaultValues: YouthFormData = {
  firstName: '',
  lastName: '',
  email: '',
  dateOfBirth: '',
  schoolId: '',
  gradeLevel: undefined,
};

interface UseYouthModalProps {
  isOpen: boolean;
  youthData?: YouthProfile;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
  includeLoginEmail?: boolean;
}

export function useYouthModal({ isOpen, youthData, onClose, onSuccess, includeLoginEmail = false }: UseYouthModalProps) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<YouthFormData>({
    resolver: zodResolver(youthSchema),
    defaultValues,
  });

  const { schools, upsertSchool, removeSchool, loading: schoolsLoading, error: schoolsError } = useSchools();
  const schoolId = watch('schoolId');

  const {
    addresses,
    initialize: initAddresses,
    reset: resetAddresses,
    handleChange: handleAddressChange,
    validate: validateAddresses,
    getPayload: getAddressPayload,
  } = useAddresses();

  const {
    contacts,
    initialize: initContacts,
    reset: resetContacts,
    handleChange: handleContactChange,
    validate: validateContacts,
    getPayload: getContactPayload,
  } = useContacts();

  // Pre-fill form when editing
  useEffect(() => {
    if (!isOpen || !youthData) return;

    reset({
      firstName: youthData.firstName || '',
      lastName: youthData.lastName || '',
      email: youthData.account?.email || '',
      dateOfBirth: youthData.dateOfBirth ? youthData.dateOfBirth.split('T')[0] : '',
      schoolId: youthData.schoolId || '',
      gradeLevel: youthData.gradeLevel ?? undefined,
    });

    initAddresses(youthData.addresses);
    initContacts(youthData.contacts);
  }, [isOpen, youthData, reset, initAddresses, initContacts]);

  const resetForm = () => {
    reset(defaultValues);
    resetAddresses();
    resetContacts();
    resetStatus();
    unlock();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const onValid = async (data: YouthFormData) => {
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setError('');

    const addressError = validateAddresses();
    if (addressError) {
      setError(addressError);
      setSubmitStatus('error');
      unlock();
      return;
    }

    const contactError = validateContacts();
    if (contactError) {
      setError(contactError);
      setSubmitStatus('error');
      unlock();
      return;
    }

    let savedYouth: YouthProfile;
    try {
      const payload = {
        ...(youthData && { id: youthData.id }),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        ...(includeLoginEmail && data.email && { email: data.email.trim() }),
        ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
        ...(data.schoolId && { schoolId: data.schoolId }),
        ...(data.gradeLevel != null && !Number.isNaN(data.gradeLevel) && { gradeLevel: data.gradeLevel }),
        addresses: getAddressPayload(),
        contacts: getContactPayload(),
      };

      savedYouth = await setYouth(payload);
    } catch (err: unknown) {
      setError(getErrorMessage(err, youthData ? 'Failed to update youth profile' : 'Failed to create youth profile'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    setSubmitStatus('success');
    onSuccess(savedYouth);
  };

  return {
    // RHF
    register,
    errors,
    rhfHandleSubmit,
    onValid,
    // Sub-entity state
    schools,
    upsertSchool,
    removeSchool,
    schoolsLoading,
    schoolsError,
    schoolId,
    setSchoolId: (id: string) => setValue('schoolId', id, { shouldDirty: true }),
    addresses,
    handleAddressChange,
    contacts,
    handleContactChange,
    // Submit state
    submitStatus,
    error,
    // Actions
    handleClose,
  };
}
