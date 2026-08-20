import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import FormField from '../../../../../components/FormField/FormField';
import Modal from '../../../../../components/Modal/Modal';
import ModalFormFooter from '../../../../../components/Modal/components/ModalFormFooter';
import { useSubmitStatus, type SubmitStatus } from '../../../../../hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/clientErrors';
import { createProgram } from '../../../programs.api';
import type { Program } from '../../../types';

const addProgramSchema = z.object({
  name: z.string().trim().min(1, 'Program name is required').max(120),
});

type AddProgramFormValues = z.infer<typeof addProgramSchema>;

interface AddProgramModalProps {
  isOpen: boolean;
  programsError: string;
  onClose: () => void;
  onCreated: (program: Program) => void;
}

function getStatusMessage(status: SubmitStatus, error: string) {
  if (status === 'submitting') return 'Adding program...';
  if (status === 'success') return 'Program added!';
  if (status === 'error') return error;
  return undefined;
}

export default function AddProgramModal({
  isOpen,
  programsError,
  onClose,
  onCreated,
}: AddProgramModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddProgramFormValues>({
    resolver: zodResolver(addProgramSchema),
    defaultValues: { name: '' },
  });
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();

  // Reopening starts a fresh form and submission lifecycle.
  useEffect(() => {
    if (!isOpen) return;
    reset({ name: '' });
    resetStatus();
  }, [isOpen, reset, resetStatus]);

  const submit = async ({ name }: AddProgramFormValues) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const program = await createProgram(name);
      onCreated(program);
      setSubmitStatus('success');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to add program'));
      setSubmitStatus('error');
    }
  };

  const close = () => {
    onClose();
    resetStatus();
  };

  const footer = (
    <ModalFormFooter
      formId="add-program-form"
      submitLabel="Add Program"
      submitStatus={submitStatus}
      onClose={close}
    />
  );
  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Add Program"
      status={submitStatus}
      successDelay={500}
      statusMessage={getStatusMessage(submitStatus, error)}
      footer={footer}
    >
      <form id="add-program-form" onSubmit={handleSubmit(submit)} noValidate>
        <FormField
          id="new-program-name"
          label="Program Name *"
          error={errors.name?.message || programsError || undefined}
        >
          <input id="new-program-name" autoFocus {...register('name')} />
        </FormField>
      </form>
    </Modal>
  );
}
