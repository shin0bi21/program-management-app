import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import {
  outreachFormDefaultValues,
  outreachFormSchema,
  type OutreachFormValues,
} from '../../../../../common/features/outreach/components/OutreachForm/outreachFormSchema';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/clientErrors';
import { createLead, updateLead } from '../../leads.api';
import type { Lead } from '../../types';

const valuesForLead = (lead?: Lead): OutreachFormValues => (
  lead
    ? {
        youthFirstName: lead.youthFirstName,
        youthLastName: lead.youthLastName,
        age: lead.age,
        school: lead.school,
        contactPhoneNumber: lead.contactPhoneNumber,
        contactRelationship: lead.contactRelationship,
        discoverySource: lead.discoverySource,
        notes: lead.notes ?? '',
      }
    : outreachFormDefaultValues
);

export function useLeadModal({ isOpen, onClose, onSuccess, lead }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<OutreachFormValues>({
    resolver: zodResolver(outreachFormSchema),
    defaultValues: outreachFormDefaultValues,
  });

  useEffect(() => {
    if (isOpen) reset(valuesForLead(lead));
  }, [isOpen, lead, reset]);

  const resetForm = () => {
    reset(outreachFormDefaultValues);
    resetStatus();
  };
  const handleClose = () => {
    resetForm();
    onClose();
  };

  const onValid = async (data: OutreachFormValues) => {
    setSubmitStatus('submitting');
    setError('');

    let savedLead: Lead;
    try {
      const payload = {
        youthFirstName: data.youthFirstName.trim(),
        youthLastName: data.youthLastName.trim(),
        age: data.age,
        school: data.school.trim(),
        contactPhoneNumber: data.contactPhoneNumber.trim(),
        contactRelationship: data.contactRelationship,
        discoverySource: data.discoverySource,
        notes: data.notes.trim() || undefined,
      };
      savedLead = lead ? await updateLead(lead.id, payload) : await createLead(payload);
    } catch (err) {
      setError(getErrorMessage(err, lead ? 'Unable to update lead' : 'Unable to create lead'));
      setSubmitStatus('error');
      return;
    }

    setSubmitStatus('success');
    onSuccess(savedLead);
  };

  return { register, control, errors, handleSubmit, onValid, submitStatus, error, handleClose };
}
