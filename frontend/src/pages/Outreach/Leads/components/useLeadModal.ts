import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { createLead, updateLead } from '../api/leads.api';
import type { Lead } from '../types';
import { leadSchema, type LeadFormData } from './leadSchema';

const defaultValues: LeadFormData = {
  youthFirstName: '', youthLastName: '', age: Number.NaN, school: '',
  contactFirstName: '', contactLastName: '', contactPhoneNumber: '', contactRelationship: 'parent',
  discoverySource: 'online', notes: '',
};

const valuesForLead = (lead?: Lead): LeadFormData => lead ? {
  youthFirstName: lead.youthFirstName,
  youthLastName: lead.youthLastName,
  age: lead.age,
  school: lead.school,
  contactFirstName: lead.contactFirstName,
  contactLastName: lead.contactLastName,
  contactPhoneNumber: lead.contactPhoneNumber,
  contactRelationship: lead.contactRelationship,
  discoverySource: lead.discoverySource,
  notes: lead.notes ?? '',
} : defaultValues;

export function useLeadModal({ isOpen, onClose, onSuccess, lead }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isOpen) reset(valuesForLead(lead));
  }, [isOpen, lead, reset]);

  const resetForm = () => { reset(defaultValues); resetStatus(); };
  const handleClose = () => { resetForm(); onClose(); };

  const onValid = async (data: LeadFormData) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const payload = {
        youthFirstName: data.youthFirstName.trim(), youthLastName: data.youthLastName.trim(), age: data.age,
        school: data.school.trim(), contactFirstName: data.contactFirstName.trim(), contactLastName: data.contactLastName.trim(),
        contactPhoneNumber: data.contactPhoneNumber.trim(), contactRelationship: data.contactRelationship,
        discoverySource: data.discoverySource, notes: data.notes.trim() || undefined,
      };
      const savedLead = lead ? await updateLead(lead.id, payload) : await createLead(payload);
      setSubmitStatus('success');
      window.setTimeout(() => { resetForm(); onSuccess(savedLead); }, 800);
    } catch (err) {
      setError(getErrorMessage(err, lead ? 'Unable to update lead' : 'Unable to create lead'));
      setSubmitStatus('error');
    }
  };

  return { register, errors, handleSubmit, onValid, submitStatus, error, handleClose };
}
