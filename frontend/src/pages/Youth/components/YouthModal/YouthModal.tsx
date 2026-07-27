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
  mode?: 'full' | 'contact';
}

export default function YouthModal({
  isOpen,
  onClose,
  onSuccess,
  youthData,
  showLoginEmail = false,
  mode = 'full',
}: YouthModalProps) {
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

  const contactOnly = mode === 'contact';
  let title = 'Add Youth Profile';
  let submitLabel = 'Add Profile';

  if (showLoginEmail) {
    title = 'Invite Youth';
    submitLabel = 'Invite Youth';
  }
  if (youthData) {
    title = 'Update Youth Profile';
    submitLabel = 'Update Profile';
  }
  if (contactOnly) {
    title = 'Primary Contact';
    submitLabel = 'Save Contact';
  }

  let modalStatusMessage: string | undefined;
  if (submitStatus === 'submitting') {
    modalStatusMessage = contactOnly
      ? 'Saving primary contact...'
      : youthData ? 'Updating youth profile...' : 'Creating youth profile...';
  } else if (submitStatus === 'success') {
    modalStatusMessage = contactOnly
      ? 'Primary contact saved successfully!'
      : youthData ? 'Youth profile updated successfully!' : 'Youth profile created successfully!';
  } else if (submitStatus === 'error') {
    modalStatusMessage = error;
  }
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
        statusMessage={modalStatusMessage}
      >
        <form id="youth-form" onSubmit={rhfHandleSubmit(onValid)}>
          {!contactOnly && (
            <>
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
                  {addresses.map((address, index) => (
                    <div key={index} className="address-form-item">
                      <FormField id={`address-${index}`} label="Street Address">
                        <input
                          id={`address-${index}`}
                          type="text"
                          value={address.address}
                          onChange={event => handleAddressChange(index, 'address', event.target.value)}
                          placeholder="123 Main Street"
                        />
                      </FormField>
                      <div className="form-row">
                        <FormField id={`city-${index}`} label="City">
                          <input
                            id={`city-${index}`}
                            type="text"
                            value={address.city}
                            onChange={event => handleAddressChange(index, 'city', event.target.value)}
                            placeholder="Toronto"
                          />
                        </FormField>
                        <FormField id={`province-${index}`} label="Province">
                          <input
                            id={`province-${index}`}
                            type="text"
                            value={address.province}
                            onChange={event => handleAddressChange(index, 'province', event.target.value)}
                            placeholder="ON"
                          />
                        </FormField>
                      </div>
                      <FormField id={`postalCode-${index}`} label="Postal Code">
                        <input
                          id={`postalCode-${index}`}
                          type="text"
                          value={address.postalCode}
                          onChange={event => handleAddressChange(index, 'postalCode', event.target.value)}
                          placeholder="A1A 1A1"
                        />
                      </FormField>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Contacts Section */}
          <div className={contactOnly ? undefined : 'section-divider'}>
            <div className="section-header">
              <h3>Primary Contact <span className="section-optional">(optional)</span></h3>
            </div>

            <div className="section-content">
              {contacts.map((contact, index) => (
                <div key={index} className="contact-form-item">
                  <div className="form-row">
                    <FormField id={`contact-firstName-${index}`} label="First Name">
                      <input
                        id={`contact-firstName-${index}`}
                        type="text"
                        value={contact.firstName}
                        onChange={(e) => handleContactChange(index, 'firstName', e.target.value)}
                        placeholder="John"
                      />
                    </FormField>
                    <FormField id={`contact-lastName-${index}`} label="Last Name">
                      <input
                        id={`contact-lastName-${index}`}
                        type="text"
                        value={contact.lastName}
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
                        value={contact.phoneNumber}
                        onChange={(e) => handleContactChange(index, 'phoneNumber', e.target.value)}
                        placeholder="(416) 555-1234"
                      />
                    </FormField>
                    <FormField id={`type-${index}`} label="Relationship">
                      <select
                        id={`type-${index}`}
                        value={contact.type}
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
      {!contactOnly && (
        <AddSchoolModal
          isOpen={addSchoolOpen}
          onClose={() => setAddSchoolOpen(false)}
          onSuccess={school => {
            setSchools(previous => [...previous.filter(item => item.id !== school.id), school]);
            setSchoolId(school.id);
            setAddSchoolOpen(false);
          }}
        />
      )}
    </>
  );
}
