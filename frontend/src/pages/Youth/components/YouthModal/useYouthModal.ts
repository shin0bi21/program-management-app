import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setYouth } from '../../../../common/api/youth.api';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { useSchools } from '../../../../common/hooks/useSchools';
import { useContacts } from '../../../../common/hooks/useContacts';
import { useAddresses } from '../../../../common/hooks/useAddresses';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { youthSchema, type YouthFormData } from './youthSchema';
import type { YouthProfile } from '../../hooks/useYouth';

const defaultValues: YouthFormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  schoolId: '',
  gradeLevel: undefined,
};

interface UseYouthModalProps {
  isOpen: boolean;
  youthData?: YouthProfile;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
}

export function useYouthModal({ isOpen, youthData, onClose, onSuccess }: UseYouthModalProps) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<YouthFormData>({
    resolver: zodResolver(youthSchema),
    defaultValues,
  });

  const { schools } = useSchools();

  const {
    addresses,
    initialize: initAddresses,
    reset: resetAddresses,
    // handleAdd: handleAddAddress,
    // handleDelete: handleDeleteAddress,
    handleChange: handleAddressChange,
    validate: validateAddresses,
    getPayload: getAddressPayload,
  } = useAddresses();

  const {
    contacts,
    initialize: initContacts,
    reset: resetContacts,
    // handleAdd: handleAddContact,
    // handleDelete: handleDeleteContact,
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
      dateOfBirth: youthData.dateOfBirth ? youthData.dateOfBirth.split('T')[0] : '',
      schoolId: youthData.schoolId || '',
      gradeLevel: youthData.gradeLevel ?? undefined,
    });

    initAddresses(youthData.addresses);
    initContacts(youthData.contacts);
  }, [isOpen, youthData]);

  const resetForm = () => {
    reset(defaultValues);
    resetAddresses();
    resetContacts();
    resetStatus();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const onValid = async (data: YouthFormData) => {
    setSubmitStatus('submitting');
    setError('');

    const addressError = validateAddresses();
    if (addressError) {
      setError(addressError);
      setSubmitStatus('error');
      return;
    }

    const contactError = validateContacts();
    if (contactError) {
      setError(contactError);
      setSubmitStatus('error');
      return;
    }

    try {
      const payload = {
        ...(youthData && { id: youthData.id }),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        status: youthData?.status ?? 'active',
        ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
        ...(data.schoolId && { schoolId: data.schoolId }),
        ...(data.gradeLevel != null && !Number.isNaN(data.gradeLevel) && { gradeLevel: data.gradeLevel }),
        addresses: getAddressPayload(),
        contacts: getContactPayload(),
      };

      const savedYouth = await setYouth(payload);

      setSubmitStatus('success');

      setTimeout(() => {
        resetForm();
        onSuccess(savedYouth);
      }, 800);
    } catch (err: unknown) {
      setError(getErrorMessage(err, youthData ? 'Failed to update youth profile' : 'Failed to create youth profile'));
      setSubmitStatus('error');
    }
  };

  return {
    // RHF
    register,
    errors,
    rhfHandleSubmit,
    onValid,
    // Sub-entity state
    schools,
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
