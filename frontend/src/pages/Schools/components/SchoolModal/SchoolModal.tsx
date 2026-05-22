import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
import type { School } from '../../types';
import { useSchoolModal } from './useSchoolModal';
import './SchoolModal.css';

interface SchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (school: School) => void;
  schoolData?: School;
}

export default function SchoolModal({ isOpen, onClose, onSuccess, schoolData }: SchoolModalProps) {
  const { register, errors, rhfHandleSubmit, onValid, submitStatus, error, handleClose } = useSchoolModal({ isOpen, schoolData, onClose, onSuccess });

  const footer = (
    <ModalFormFooter
      formId="school-form"
      submitLabel={schoolData ? 'Save Changes' : 'Add School'}
      submitStatus={submitStatus}
      onClose={handleClose}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={schoolData ? 'Edit School' : 'Add School'}
      footer={footer}
      status={submitStatus}
      statusMessage={
        submitStatus === 'submitting' ? (schoolData ? 'Saving changes...' : 'Adding school...') :
        submitStatus === 'success' ? (schoolData ? 'School updated!' : 'School added!') :
        submitStatus === 'error' ? error :
        undefined
      }
    >
      <form id="school-form" onSubmit={rhfHandleSubmit(onValid)} className="school-form" noValidate>
        <FormField id="school-name" label="School Name *" error={errors.name?.message}>
          <input id="school-name" type="text" {...register('name')} />
        </FormField>

        <FormField id="school-board" label="Board" error={errors.board?.message}>
          <select id="school-board" {...register('board')}>
            <option value="">— Select board —</option>
            <option value="public">Public</option>
            <option value="catholic">Catholic</option>
          </select>
        </FormField>

        <FormField id="school-address" label="Address" error={errors.address?.message}>
          <input id="school-address" type="text" {...register('address')} />
        </FormField>

        <FormField id="school-postal" label="Postal Code" error={errors.postalCode?.message}>
          <input id="school-postal" type="text" {...register('postalCode')} />
        </FormField>
      </form>
    </Modal>
  );
}
