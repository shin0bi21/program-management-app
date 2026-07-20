import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { createLead } from '../api/leads.api';
import type { Lead } from '../types';
import { leadSchema, type LeadFormData } from './leadSchema';

const defaultValues: LeadFormData = {
  youthFirstName: '', youthLastName: '', age: Number.NaN, school: '',
  contactFirstName: '', contactLastName: '', contactPhoneNumber: '', contactRelationship: 'parent',
  responseEmail: '', responsePhoneNumber: '', discoverySource: 'online', notes: '',
};

export function useLeadModal({ isOpen, onClose, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isOpen) reset(defaultValues);
  }, [isOpen, reset]);

  const resetForm = () => { reset(defaultValues); resetStatus(); };
  const handleClose = () => { resetForm(); onClose(); };

  const onValid = async (data: LeadFormData) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const lead = await createLead({
        youthFirstName: data.youthFirstName.trim(), youthLastName: data.youthLastName.trim(), age: data.age,
        school: data.school.trim(), contactFirstName: data.contactFirstName.trim(), contactLastName: data.contactLastName.trim(),
        contactPhoneNumber: data.contactPhoneNumber.trim(), contactRelationship: data.contactRelationship,
        responseEmail: data.responseEmail.trim() || undefined, responsePhoneNumber: data.responsePhoneNumber.trim() || undefined,
        discoverySource: data.discoverySource, notes: data.notes.trim() || undefined,
      });
      setSubmitStatus('success');
      window.setTimeout(() => { resetForm(); onSuccess(lead); }, 800);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create lead'));
      setSubmitStatus('error');
    }
  };

  return { register, errors, handleSubmit, onValid, submitStatus, error, handleClose };
}
