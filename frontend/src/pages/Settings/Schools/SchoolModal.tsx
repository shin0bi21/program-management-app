import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormField from '../../../common/components/FormField/FormField';
import Modal from '../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../common/components/ModalFormFooter/ModalFormFooter';
import { setSchool } from '../../../common/api/schools.api';
import { useSubmitStatus } from '../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import type { School } from '../../../common/types/school';
import { schoolSchema, type SchoolFormData } from './schoolSchema';

interface Props { school?: School; onClose: () => void; onSuccess: (school: School) => void }

export default function SchoolModal({ school, onClose, onSuccess }: Props) {
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SchoolFormData>({
    resolver: zodResolver(schoolSchema),
  });

  useEffect(() => {
    reset({
      name: school?.name ?? '',
      board: school?.board === 'catholic' || school?.board === 'public' ? school.board : '',
      address: school?.address ?? '',
      postalCode: school?.postalCode ?? '',
    });
    resetStatus();
  }, [reset, resetStatus, school]);

  const submit = async (values: SchoolFormData) => {
    setSubmitStatus('submitting');
    setError('');
    try {
      const saved = await setSchool({
        id: school?.id,
        name: values.name,
        board: values.board || null,
        address: values.address || null,
        postalCode: values.postalCode || null,
      });
      setSubmitStatus('success');
      window.setTimeout(() => onSuccess(saved), 500);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save school'));
      setSubmitStatus('error');
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={school ? 'Edit School' : 'Add School'}
      status={submitStatus}
      statusMessage={submitStatus === 'submitting' ? 'Saving school...' : submitStatus === 'success' ? 'School saved!' : submitStatus === 'error' ? error : undefined}
      footer={<ModalFormFooter formId="school-form" submitLabel={school ? 'Update' : 'Add'} submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id="school-form" onSubmit={handleSubmit(submit)}>
        <FormField id="school-name" label="School Name *" error={errors.name?.message}>
          <input id="school-name" {...register('name')} />
        </FormField>
        <FormField id="school-board" label="Board" error={errors.board?.message}>
          <select id="school-board" {...register('board')}>
            <option value="">Not specified</option>
            <option value="public">Public</option>
            <option value="catholic">Catholic</option>
          </select>
        </FormField>
        <FormField id="school-address" label="Address" error={errors.address?.message}>
          <input id="school-address" {...register('address')} />
        </FormField>
        <FormField id="school-postal-code" label="Postal Code" error={errors.postalCode?.message}>
          <input id="school-postal-code" {...register('postalCode')} />
        </FormField>
      </form>
    </Modal>
  );
}
