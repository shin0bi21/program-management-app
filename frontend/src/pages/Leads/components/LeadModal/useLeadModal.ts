import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import {
  outreachFormDefaultValues,
  outreachFormSchema,
  type OutreachFormValues,
} from '../../../../common/features/OutreachForm/outreachFormSchema';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../http/errors';
import { createLead, updateLead } from '../../leads.api';
import type { Lead } from '../../types';

/**
 * Initializes one lead edit draft per open target and submits its normalized fields.
 * Saved-record refreshes for the same target leave the editable draft intact.
 * @param options - Open state, current saved target, and completion callbacks.
 * @example useLeadModal({ isOpen: true, lead, onClose, onSuccess })
 */
export function useLeadModal({ isOpen, onClose, onSuccess, lead }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<OutreachFormValues>({
    resolver: zodResolver(outreachFormSchema),
    defaultValues: outreachFormDefaultValues,
  });

  const leadId = lead?.id;
  const leadRef = useRef(lead);
  leadRef.current = lead;

  useEffect(() => {
    if (isOpen) reset(valuesForLead(leadRef.current));
  }, [isOpen, leadId, reset]);

  const resetForm = () => {
    reset(outreachFormDefaultValues);
    resetStatus();
    unlock();
  };
  const handleClose = () => {
    resetForm();
    onClose();
  };

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

  return { register, control, errors, handleSubmit, onValid, submitStatus, error, handleClose };
}

/**
 * Initializes an editable draft from a saved lead, leaving legacy birth dates blank.
 * @param lead - Saved record to edit; omitted for creation.
 * @example valuesForLead(undefined) // empty outreach form values
 */
const valuesForLead = (lead?: Lead): OutreachFormValues => (
  lead
    ? {
        youthFirstName: lead.youthFirstName,
        youthLastName: lead.youthLastName,
        dateOfBirth: lead.dateOfBirth ?? '',
        school: lead.school,
        contactPhoneNumber: lead.contactPhoneNumber,
        contactRelationship: lead.contactRelationship,
        discoverySource: lead.discoverySource,
        notes: lead.notes ?? '',
      }
    : outreachFormDefaultValues
);
