import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProgram } from '../../api/programs.api';
import { useAuth } from '../../../../common/context/AuthContext';
import { usePrograms } from '../../hooks/usePrograms';
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';

const schema = z.object({ name: z.string().trim().min(1, 'Program name is required').max(120) });
type FormValues = z.infer<typeof schema>;

interface ProgramSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export default function ProgramSelect({ id, value, onChange }: ProgramSelectProps) {
  const { permissions } = useAuth();
  const { programs, upsertProgram, loading, error: programsError } = usePrograms();
  const [addOpen, setAddOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();

  useEffect(() => {
    if (addOpen) {
      reset({ name: '' });
      resetStatus();
    }
  }, [addOpen, reset, resetStatus]);

  const close = () => {
    setAddOpen(false);
    resetStatus();
  };

  const submit = async ({ name }: FormValues) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const program = await createProgram(name.trim());
      upsertProgram(program);
      onChange(program.id);
      setSubmitStatus('success');
      window.setTimeout(close, 500);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to add program'));
      setSubmitStatus('error');
    }
  };

  return <>
    <FloatingSelect
      id={id}
      value={value}
      options={programs.map(program => ({ value: program.id, label: program.name }))}
      onChange={onChange}
      placeholder={loading ? 'Loading programs...' : 'Select a program'}
      disabled={loading}
      action={permissions.includes('write:programs') ? { label: '+ Add program', onSelect: () => setAddOpen(true) } : undefined}
    />
    <Modal
      isOpen={addOpen}
      onClose={close}
      title="Add Program"
      status={submitStatus}
      statusMessage={submitStatus === 'submitting' ? 'Adding program...' : submitStatus === 'success' ? 'Program added!' : submitStatus === 'error' ? error : undefined}
      footer={<ModalFormFooter formId="add-program-form" submitLabel="Add Program" submitStatus={submitStatus} onClose={close} />}
    >
      <form id="add-program-form" onSubmit={handleSubmit(submit)} noValidate>
        <FormField id="new-program-name" label="Program Name *" error={errors.name?.message || programsError || undefined}>
          <input id="new-program-name" autoFocus {...register('name')} />
        </FormField>
      </form>
    </Modal>
  </>;
}
