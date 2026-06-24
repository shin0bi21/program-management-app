import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
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
    <ModalFormFooter
      formId="youth-form"
      submitLabel={youthData ? 'Update Form' : 'Sign Up'}
      submitStatus={submitStatus}
      onClose={handleClose}
    />
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={youthData ? 'Update Form' : 'Sign Up Form'} 
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
        {/* General Information */}
        <div className="section-header">
          <h3>General Information</h3>
        </div>
        <div className="form-row">
          <FormField id="firstName" label="First Name *" error={errors.firstName?.message}>
            <input id="firstName" type="text" {...register('firstName')} />
          </FormField>
          <FormField id="lastName" label="Last Name *" error={errors.lastName?.message}>
            <input id="lastName" type="text" {...register('lastName')} />
          </FormField>
        </div>

        <div className="form-row">
          <FormField id="dateOfBirth" label="Date of Birth">
            <input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          </FormField>
          <FormField id="gradeLevel" label="Grade" error={errors.gradeLevel?.message}>
            <input id="gradeLevel" type="number" min="0" max="12" placeholder="0–12" {...register('gradeLevel', { valueAsNumber: true })} />
          </FormField>
        </div>

        <FormField id="school" label="School">
          <select id="school" {...register('schoolId')}>
            <option value="">Select a school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </FormField>

        {/* Addresses Section */}
        <div className="section-divider">
          <div className="section-header">
            <h3>Address <span className="section-optional">(optional)</span></h3>
          </div>
          
          <div className="section-content">
            {addresses.map((addr, index) => (
                <div key={index} className="address-form-item">
                  <FormField id={`address-${index}`} label="Street Address">
                    <input
                      id={`address-${index}`}
                      type="text"
                      value={addr.address}
                      onChange={(e) => handleAddressChange(index, 'address', e.target.value)}
                      placeholder="123 Main Street"
                    />
                  </FormField>
                  <div className="form-row">
                    <FormField id={`city-${index}`} label="City">
                      <input
                        id={`city-${index}`}
                        type="text"
                        value={addr.city}
                        onChange={(e) => handleAddressChange(index, 'city', e.target.value)}
                        placeholder="Toronto"
                      />
                    </FormField>
                    <FormField id={`province-${index}`} label="Province">
                      <input
                        id={`province-${index}`}
                        type="text"
                        value={addr.province}
                        onChange={(e) => handleAddressChange(index, 'province', e.target.value)}
                        placeholder="ON"
                      />
                    </FormField>
                  </div>
                  <FormField id={`postalCode-${index}`} label="Postal Code">
                    <input
                      id={`postalCode-${index}`}
                      type="text"
                      value={addr.postalCode}
                      onChange={(e) => handleAddressChange(index, 'postalCode', e.target.value)}
                      placeholder="A1A 1A1"
                    />
                  </FormField>
                </div>
              ))}
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
                  <div className="form-row">
                    <FormField id={`contact-firstName-${index}`} label="First Name">
                      <input
                        id={`contact-firstName-${index}`}
                        type="text"
                        value={cont.firstName}
                        onChange={(e) => handleContactChange(index, 'firstName', e.target.value)}
                        placeholder="John"
                      />
                    </FormField>
                    <FormField id={`contact-lastName-${index}`} label="Last Name">
                      <input
                        id={`contact-lastName-${index}`}
                        type="text"
                        value={cont.lastName}
                        onChange={(e) => handleContactChange(index, 'lastName', e.target.value)}
                        placeholder="Doe"
                      />
                    </FormField>
                  </div>
                  <div className="form-row">
                    <FormField id={`phoneNumber-${index}`} label="Phone Number">
                      <input
                        id={`phoneNumber-${index}`}
                        type="tel"
                        value={cont.phoneNumber}
                        onChange={(e) => handleContactChange(index, 'phoneNumber', e.target.value)}
                        placeholder="(416) 555-1234"
                      />
                    </FormField>
                    <FormField id={`type-${index}`} label="Relationship">
                      <select
                        id={`type-${index}`}
                        value={cont.type}
                        onChange={(e) => handleContactChange(index, 'type', e.target.value)}
                      >
                        <option value="parent">Parent</option>
                        <option value="guardian">Guardian</option>
                        <option value="sibling">Sibling</option>
                      </select>
                    </FormField>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
