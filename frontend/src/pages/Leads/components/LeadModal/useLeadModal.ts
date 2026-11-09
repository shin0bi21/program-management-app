import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  outreachFormSchema,
  type OutreachFormValues,
} from '../../../../common/features/OutreachForm/outreachFormSchema';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../http/errors';
import { createLead, updateLead } from '../../leads.api';
import type { Lead } from '../../types';

/**
 * Initializes one mounted lead editor from supplied values and saves normalized fields.
 * @param options - Saved target, if editing, and authoritative save callback.
 * @example useLeadModal({ lead, onSuccess }) // starts from the supplied lead
 */
export function useLeadModal({ onSuccess, lead }: {
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}) {
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();
  const { register, handleSubmit, control, formState: { errors } } = useForm<OutreachFormValues>({
    resolver: zodResolver(outreachFormSchema),
    defaultValues: {
      youthFirstName: lead?.youthFirstName ?? '',
      youthLastName: lead?.youthLastName ?? '',
      dateOfBirth: lead?.dateOfBirth ?? '',
      school: lead?.school ?? '',
      contactPhoneNumber: lead?.contactPhoneNumber ?? '',
      contactRelationship: lead?.contactRelationship,
      discoverySource: lead?.discoverySource,
      notes: lead?.notes ?? '',
    },
  });

  const onValid = async (data: OutreachFormValues) => {
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setError('');

    let savedLead: Lead;
    try {
      const payload = {
        youthFirstName: data.youthFirstName.trim(),
        youthLastName: data.youthLastName.trim(),
        dateOfBirth: data.dateOfBirth,
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
      unlock();
      return;
    }

    setSubmitStatus('success');
    onSuccess(savedLead);
  };

  return { register, control, errors, handleSubmit, onValid, submitStatus, error };
}
