import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import FormField from '../../../../components/FormField/FormField';
import FloatingSelect from '../../../../components/FloatingSelect/FloatingSelect';
import Modal from '../../../../components/Modal/Modal';
import ModalFormFooter from '../../../../components/Modal/components/ModalFormFooter';
import { useAuth } from '../../../../../auth/authContext';
import type { YouthProfile } from '../../../../types/youth';
import SchoolActionModal, { type SchoolAction } from './SchoolActionModal/SchoolActionModal';
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
  const canManageSchools = permissions.includes('write:schools');
  const [schoolAction, setSchoolAction] = useState<SchoolAction | null>(null);
  const {
    register,
    errors,
    rhfHandleSubmit,
    onValid,
    schools,
    upsertSchool,
    removeSchool,
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
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
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
    setSchoolAction(null);
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
        successDelay={800}
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
                  <input id="firstName" type="text" disabled={submissionComplete} {...register('firstName')} />
                </FormField>
                <FormField id="lastName" label="Last Name *" error={errors.lastName?.message}>
                  <input id="lastName" type="text" disabled={submissionComplete} {...register('lastName')} />
                </FormField>
              </div>

              <div className="form-row">
                <FormField id="dateOfBirth" label="Date of Birth">
                  <input id="dateOfBirth" type="date" disabled={submissionComplete} {...register('dateOfBirth')} />
                </FormField>
                <FormField id="gradeLevel" label="Grade" error={errors.gradeLevel?.message}>
                  <input id="gradeLevel" type="number" min="0" max="12" placeholder="0–12" disabled={submissionComplete} {...register('gradeLevel', { valueAsNumber: true })} />
                </FormField>
              </div>

              {showLoginEmail && (
                <FormField id="email" label="Login Email" error={errors.email?.message}>
                  <input
                    id="email"
                    type="email"
                    placeholder="youth@example.com"
                    disabled={submissionComplete || !!youthData?.account}
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
                  disabled={submissionComplete || schoolsLoading}
                  action={canManageSchools ? { label: '+ Add school', onSelect: () => setSchoolAction({ type: 'add' }) } : undefined}
                  optionActions={canManageSchools ? option => {
                    const school = schools.find(item => item.id === option.value)!;
                    return [
                      { label: 'Edit', icon: <FontAwesomeIcon icon={faPen} />, onSelect: () => setSchoolAction({ type: 'edit', school }) },
                      { label: 'Delete', icon: <FontAwesomeIcon icon={faTrash} />, variant: 'danger', onSelect: () => setSchoolAction({ type: 'delete', school }) },
                    ];
                  } : undefined}
                />
              </FormField>

              {addresses.map((address, index) => (
                <FormField key={index} id={`address-${index}`} label="Address (optional)">
                  <input
                    id={`address-${index}`}
                    type="text"
                    value={address.address}
                    onChange={event => handleAddressChange(index, 'address', event.target.value)}
                    placeholder="123 Main Street"
                    disabled={submissionComplete}
                  />
                </FormField>
              ))}
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
                    <FormField id={`phoneNumber-${index}`} label="Phone Number *">
                      <input
                        id={`phoneNumber-${index}`}
                        type="tel"
                        value={contact.phoneNumber}
                        onChange={(e) => handleContactChange(index, 'phoneNumber', e.target.value)}
                        placeholder="(416) 555-1234"
                        disabled={submissionComplete}
                      />
                    </FormField>
                    <FormField id={`type-${index}`} label="Relationship *">
                      <FloatingSelect
                        id={`type-${index}`}
                        ariaLabel={`Relationship ${index + 1}`}
                        value={contact.type}
                        options={[
                          { value: 'parent', label: 'Parent' },
                          { value: 'guardian', label: 'Guardian' },
                          { value: 'sibling', label: 'Sibling' },
                        ]}
                        onChange={value => handleContactChange(index, 'type', value)}
                        disabled={submissionComplete}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
      {!contactOnly && (
        <SchoolActionModal
          action={schoolAction}
          onClose={() => setSchoolAction(null)}
          onUpsert={school => {
            upsertSchool(school);
            if (schoolAction?.type === 'add') setSchoolId(school.id);
            setSchoolAction(null);
          }}
          onDelete={school => {
            removeSchool(school.id);
            if (schoolId === school.id) setSchoolId('');
            setSchoolAction(null);
          }}
        />
      )}
    </>
  );
}
