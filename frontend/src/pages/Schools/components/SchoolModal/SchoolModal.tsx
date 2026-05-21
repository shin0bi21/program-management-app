import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
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
    <>
      <Button type="button" variant="secondary" onClick={handleClose} disabled={submitStatus === 'submitting' || submitStatus === 'success'}>
        Cancel
      </Button>
      <Button type="submit" form="school-form" disabled={submitStatus === 'submitting' || submitStatus === 'success'}>
        {schoolData ? 'Save Changes' : 'Add School'}
      </Button>
    </>
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
        <div className="form-group">
          <label htmlFor="school-name">School Name *</label>
          <input id="school-name" type="text" {...register('name')} />
          {errors.name && <span className="field-error">{errors.name.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="school-board">Board</label>
          <select id="school-board" {...register('board')}>
            <option value="">— Select board —</option>
            <option value="public">Public</option>
            <option value="catholic">Catholic</option>
          </select>
          {errors.board && <span className="field-error">{errors.board.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="school-address">Address</label>
          <input id="school-address" type="text" {...register('address')} />
          {errors.address && <span className="field-error">{errors.address.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="school-postal">Postal Code</label>
          <input id="school-postal" type="text" {...register('postalCode')} />
          {errors.postalCode && <span className="field-error">{errors.postalCode.message}</span>}
        </div>
      </form>
    </Modal>
  );
}
