import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import useSubmitLock from '../../../../../../hooks/useSubmitLock';
import { useSubmitStatus, type SubmitStatus } from '../../../../../../hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../../http/errors';
import { createProgram } from '../../../../programs.api';
import type { Program } from '../../../../types';

const addProgramSchema = z.object({
  name: z.string().trim().min(1, 'Program name is required').max(120),
});

type AddProgramFormValues = z.infer<typeof addProgramSchema>;

function getStatusMessage(status: SubmitStatus, error: string) {
  if (status === 'submitting') return 'Adding program...';
  if (status === 'success') return 'Program added!';
  if (status === 'error') return error;
  return undefined;
}

export default function useAddProgramModal({ isOpen, onCreated }: {
  isOpen: boolean;
  onCreated: (program: Program) => void;
}) {
  const form = useForm<AddProgramFormValues>({
    resolver: zodResolver(addProgramSchema),
    defaultValues: { name: '' },
  });
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!isOpen) return;
    form.reset({ name: '' });
    resetStatus();
    unlock();
  }, [form, isOpen, resetStatus, unlock]);

  const submit = form.handleSubmit(async ({ name }) => {
    if (!tryLock()) return;

    setSubmitStatus('submitting');
    setError('');

    try {
      const program = await createProgram(name);
      onCreated(program);
      setSubmitStatus('success');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to add program'));
      setSubmitStatus('error');
      unlock();
    }
  });

  return {
    register: form.register,
    errors: form.formState.errors,
    submitStatus,
    statusMessage: getStatusMessage(submitStatus, error),
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    resetStatus,
    submit,
  };
}
