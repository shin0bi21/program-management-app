import { useState } from 'react';
import FormField from '../../../../common/components/FormField/FormField';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
import { useAuth } from '../../../../common/context/AuthContext';
import type { YouthProfile } from '../../hooks/useYouth';
import AddSchoolModal from './AddSchoolModal/AddSchoolModal';
import { useYouthModal } from './useYouthModal';
import './YouthModal.css';

interface YouthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
  youthData?: YouthProfile;
  showLoginEmail?: boolean;
}

export default function YouthModal({ isOpen, onClose, onSuccess, youthData, showLoginEmail = false }: YouthModalProps) {
  const { permissions } = useAuth();
  const canAddSchool = permissions.includes('write:schools');
  const [addSchoolOpen, setAddSchoolOpen] = useState(false);
  const {
    register,
    errors,
    rhfHandleSubmit,
    onValid,
    schools,
    setSchools,
    schoolsLoading,
    schoolsError,
    schoolId,
    setSchoolId,
    addresses,
    handleAddressChange,
    contacts,
    handleContactChange,
    submitStatus,
    error,
    handleClose,
  } = useYouthModal({ isOpen, youthData, onClose, onSuccess, includeLoginEmail: showLoginEmail });

  const title = youthData ? 'Update Youth Profile' : showLoginEmail ? 'Invite Youth' : 'Add Youth Profile';
  const submitLabel = youthData ? 'Update Profile' : showLoginEmail ? 'Invite Youth' : 'Add Profile';
  const closeYouthModal = () => {
    setAddSchoolOpen(false);
    handleClose();
  };

  const footer = (
    <ModalFormFooter
      formId="youth-form"
      submitLabel={submitLabel}
      submitStatus={submitStatus}
      onClose={closeYouthModal}
    />
  );

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={closeYouthModal}
      title={title}
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

        {showLoginEmail && (
          <FormField id="email" label="Login Email" error={errors.email?.message}>
            <input
              id="email"
              type="email"
              placeholder="youth@example.com"
              disabled={!!youthData?.account}
              {...register('email')}
            />
          </FormField>
        )}

        <FormField id="school" label="School" error={schoolsError || undefined}>
          <FloatingSelect
            id="school"
            value={schoolId ?? ''}
            options={schools.map(school => ({ value: school.id, label: school.name }))}
            onChange={setSchoolId}
            placeholder={schoolsLoading ? 'Loading schools...' : 'Select a school'}
            disabled={schoolsLoading}
            action={canAddSchool ? { label: '+ Add school', onSelect: () => setAddSchoolOpen(true) } : undefined}
          />
        </FormField>

        <FormField id="notes" label="Notes" error={errors.notes?.message}>
          <textarea id="notes" rows={4} {...register('notes')} />
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
      <AddSchoolModal
        isOpen={addSchoolOpen}
        onClose={() => setAddSchoolOpen(false)}
        onSuccess={school => {
          setSchools(previous => [...previous.filter(item => item.id !== school.id), school]);
          setSchoolId(school.id);
          setAddSchoolOpen(false);
        }}
      />
    </>
  );
}
