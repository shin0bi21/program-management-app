// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faTrash } from '@fortawesome/free-solid-svg-icons';
import Modal from '../../../../common/components/Modal/Modal';
import type { YouthProfile } from '../../hooks/useYouth';
import { useYouthModal } from './useYouthModal';
import './YouthModal.css';

interface YouthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
  youthData?: YouthProfile;
}

export default function YouthModal({ isOpen, onClose, onSuccess, youthData }: YouthModalProps) {
  const {
    register,
    errors,
    rhfHandleSubmit,
    onValid,
    schools,
    addresses,
    handleAddressChange,
    contacts,
    handleContactChange,
    submitStatus,
    error,
    handleClose,
  } = useYouthModal({ isOpen, youthData, onClose, onSuccess });

  const footer = (
    <>
      <button type="button" className="btn-cancel" onClick={handleClose} disabled={submitStatus === 'submitting' || submitStatus === 'success'}>
        Cancel
      </button>
      <button type="submit" form="youth-form" className="btn-submit" disabled={submitStatus === 'submitting' || submitStatus === 'success'}>
        {youthData ? 'Update Youth' : 'Add Youth'}
      </button>
    </>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={youthData ? 'Edit Youth' : 'Add Youth'} 
      footer={footer}
      status={submitStatus}
      statusMessage={
        submitStatus === 'submitting' ? (youthData ? 'Updating youth profile...' : 'Creating youth profile...') :
        submitStatus === 'success' ? (youthData ? 'Youth profile updated successfully!' : 'Youth profile created successfully!') :
        submitStatus === 'error' ? error :
        undefined
      }
    >
      <form id="youth-form" onSubmit={rhfHandleSubmit(onValid)}>
        {/* General Info */}
        <div className="section-title">
          <h3>General Info</h3>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="firstName">First Name *</label>
            <input
              id="firstName"
              type="text"
              {...register('firstName')}
            />
            {errors.firstName && <span className="field-error">{errors.firstName.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="lastName">Last Name *</label>
            <input
              id="lastName"
              type="text"
              {...register('lastName')}
            />
            {errors.lastName && <span className="field-error">{errors.lastName.message}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="dateOfBirth">Date of Birth</label>
            <input
              id="dateOfBirth"
              type="date"
              {...register('dateOfBirth')}
            />
          </div>
          <div className="form-field">
            <label htmlFor="gradeLevel">Grade</label>
            <input
              id="gradeLevel"
              type="number"
              min="0"
              max="12"
              placeholder="0–12"
              {...register('gradeLevel', { valueAsNumber: true })}
            />
            {errors.gradeLevel && <span className="field-error">{errors.gradeLevel.message}</span>}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="school">School</label>
          <select
            id="school"
            {...register('schoolId')}
          >
            <option value="">Select a school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              {...register('active')}
            />
            <span>Active (currently participating in cohort)</span>
          </label>
        </div>

        {/* Addresses Section */}
        <div className="section-divider">
          <div className="section-header">
            <h3>Address <span className="section-optional">(optional)</span></h3>
          </div>
          
          <div className="section-content">
            {addresses.map((addr, index) => (
                <div key={index} className="address-form-item">
                  {/* To re-enable per-item delete:
                  <div className="form-item-header">
                    <span className="form-item-label">Address {index + 1}</span>
                    <button type="button" className="btn-delete" onClick={() => handleDeleteAddress(index)} aria-label="Delete address">
                      <FontAwesomeIcon icon={faTrash} /> Delete
                    </button>
                  </div> */}
                  <div className="form-field">
                    <label htmlFor={`address-${index}`}>Street Address</label>
                    <input
                      id={`address-${index}`}
                      type="text"
                      value={addr.address}
                      onChange={(e) => handleAddressChange(index, 'address', e.target.value)}
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`city-${index}`}>City</label>
                      <input
                        id={`city-${index}`}
                        type="text"
                        value={addr.city}
                        onChange={(e) => handleAddressChange(index, 'city', e.target.value)}
                        placeholder="Toronto"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`province-${index}`}>Province</label>
                      <input
                        id={`province-${index}`}
                        type="text"
                        value={addr.province}
                        onChange={(e) => handleAddressChange(index, 'province', e.target.value)}
                        placeholder="ON"
                      />
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor={`postalCode-${index}`}>Postal Code</label>
                    <input
                      id={`postalCode-${index}`}
                      type="text"
                      value={addr.postalCode}
                      onChange={(e) => handleAddressChange(index, 'postalCode', e.target.value)}
                      placeholder="A1A 1A1"
                    />
                  </div>
                </div>
              ))}
              {/* To re-enable adding multiple addresses:
              <button type="button" className="btn-add" onClick={handleAddAddress}>+ Add Address</button> */}
          </div>
        </div>

        {/* Contacts Section */}
        <div className="section-divider">
          <div className="section-header">
            <h3>Emergency Contact <span className="section-optional">(optional)</span></h3>
          </div>
          
          <div className="section-content">
            {contacts.map((cont, index) => (
                <div key={index} className="contact-form-item">
                  {/* To re-enable per-item delete:
                  <div className="form-item-header">
                    <span className="form-item-label">Contact {index + 1}</span>
                    <button type="button" className="btn-delete" onClick={() => handleDeleteContact(index)} aria-label="Delete contact">
                      <FontAwesomeIcon icon={faTrash} /> Delete
                    </button>
                  </div> */}
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`contact-firstName-${index}`}>First Name</label>
                      <input
                        id={`contact-firstName-${index}`}
                        type="text"
                        value={cont.firstName}
                        onChange={(e) => handleContactChange(index, 'firstName', e.target.value)}
                        placeholder="John"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`contact-lastName-${index}`}>Last Name</label>
                      <input
                        id={`contact-lastName-${index}`}
                        type="text"
                        value={cont.lastName}
                        onChange={(e) => handleContactChange(index, 'lastName', e.target.value)}
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`phoneNumber-${index}`}>Phone Number</label>
                      <input
                        id={`phoneNumber-${index}`}
                        type="tel"
                        value={cont.phoneNumber}
                        onChange={(e) => handleContactChange(index, 'phoneNumber', e.target.value)}
                        placeholder="(416) 555-1234"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`type-${index}`}>Relationship</label>
                      <select
                        id={`type-${index}`}
                        value={cont.type}
                        onChange={(e) => handleContactChange(index, 'type', e.target.value)}
                      >
                        <option value="parent">Parent</option>
                        <option value="guardian">Guardian</option>
                        <option value="sibling">Sibling</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {/* To re-enable adding multiple contacts:
              <button type="button" className="btn-add" onClick={handleAddContact}>+ Add Emergency Contact</button> */}
          </div>
        </div>
      </form>
    </Modal>
  );
}
