import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import FormField from '../../../../common/components/FormField/FormField';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import { useAuth } from '../../../../auth/authContext';
import type { YouthProfile } from '../../types';
import type { SchoolAction, SchoolSelection } from '../../../../common/features/SchoolModal/types';
import { useYouthModal } from './hooks/useYouthModal';
import { getDateOfBirthBounds } from '../../../../common/features/youth/dateOfBirth';
import './YouthModal.css';

interface YouthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
  youthData?: YouthProfile;
  inviteYouth?: boolean;
  mode?: 'full' | 'contact';
  suspended?: boolean;
  onManageSchool?: (action: SchoolAction, selection: SchoolSelection) => void;
}

/**
 * Mounts one Youth profile or contact editor while its target is open.
 * Suspension hides the dialog while keeping the mounted draft for school management.
 * @param props - Visibility, supplied profile, save actions, and optional school workflow.
 * @example <YouthModal isOpen youthData={profile} onClose={close} onSuccess={save} />
 */
export default function YouthModal({ isOpen, ...props }: YouthModalProps) {
  const targetKey = `${props.mode ?? 'full'}:${props.youthData?.id ?? 'new'}`;
  return isOpen ? <YouthForm key={targetKey} {...props} /> : null;
}

/**
 * Owns supplied profile values and contact fields until close or save completion.
 * @param props - Initial values, editor mode, suspension, and completion actions.
 * @example <YouthForm youthData={profile} onClose={close} onSuccess={save} />
 */
function YouthForm({
  onClose,
  onSuccess,
  youthData,
  inviteYouth = false,
  mode = 'full',
  suspended = false,
  onManageSchool,
}: Omit<YouthModalProps, 'isOpen'>) {
  const { permissions } = useAuth();
  const canManageSchools = permissions.includes('write:schools') && !!onManageSchool;
  const {
    register,
    errors,
    rhfHandleSubmit,
    onValid,
    schools,
    schoolsLoading,
    schoolsError,
    schoolId,
    setSchoolId,
    addresses,
    contacts,
    handleContactChange,
    submitStatus,
    error,
    handleClose,
  } = useYouthModal({ youthData, onClose, onSuccess, inviteYouth, mode });

  const contactOnly = mode === 'contact';
  const birthDateBounds = getDateOfBirthBounds();
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  let title = 'Add Youth Profile';

  if (inviteYouth) {
    title = 'Invite Youth';
  }
  if (youthData) {
    title = 'Update Youth Profile';
  }
  if (contactOnly) {
    title = 'Primary Contact';
  }

  let modalStatusMessage: string | undefined;
  if (submitStatus === 'submitting') {
    modalStatusMessage = youthData ? 'Updating youth profile...' : 'Creating youth profile...';
    if (contactOnly) modalStatusMessage = 'Saving primary contact...';
  } else if (submitStatus === 'success') {
    modalStatusMessage = youthData ? 'Youth profile updated successfully!' : 'Youth profile created successfully!';
    if (contactOnly) modalStatusMessage = 'Primary contact saved successfully!';
  } else if (submitStatus === 'error') {
    modalStatusMessage = error;
  }
  const manageSchool = (action: SchoolAction) => {
    onManageSchool?.(action, { schoolId: schoolId ?? '', onChange: setSchoolId });
  };

  const footer = (
    <ModalFormFooter
      formId="youth-form"
      submitStatus={submitStatus}
      onClose={handleClose}
    />
  );

  return (
    <Modal
      isOpen={!suspended}
      onClose={handleClose}
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
                <input id="firstName" type="text" disabled={submissionComplete} {...register('firstName')} />
              </FormField>
              <FormField id="lastName" label="Last Name *" error={errors.lastName?.message}>
                <input id="lastName" type="text" disabled={submissionComplete} {...register('lastName')} />
              </FormField>
            </div>

            <div className="form-row">
              <FormField id="dateOfBirth" label="Date of Birth (optional)" error={errors.dateOfBirth?.message}>
                <input id="dateOfBirth" type="date" {...birthDateBounds} disabled={submissionComplete} {...register('dateOfBirth')} />
              </FormField>
            </div>

            {inviteYouth && (
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
                options={schools}
                onChange={setSchoolId}
                placeholder={schoolsLoading ? 'Loading schools...' : 'Select a school'}
                disabled={submissionComplete || schoolsLoading}
                action={canManageSchools ? { label: '+ Add school', onSelect: () => manageSchool({ type: 'add' }) } : undefined}
                optionActions={canManageSchools ? option => {
                  const school = schools.find(item => item.id === option.id)!;
                  return [
                    { label: 'Edit', icon: <FontAwesomeIcon icon={faPen} />, onSelect: () => manageSchool({ type: 'edit', school }) },
                    { label: 'Delete', icon: <FontAwesomeIcon icon={faTrash} />, variant: 'danger', onSelect: () => manageSchool({ type: 'delete', school }) },
                  ];
                } : undefined}
              />
            </FormField>

            {addresses.map((_, index) => (
              <FormField
                key={index}
                id={`address-${index}`}
                label="Address (optional)"
                error={errors.addresses?.[index]?.address?.message}
              >
                <input
                  id={`address-${index}`}
                  type="text"
                  placeholder="123 Main Street"
                  disabled={submissionComplete}
                  {...register(`addresses.${index}.address`)}
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
                        { id: 'parent', name: 'Parent' },
                        { id: 'guardian', name: 'Guardian' },
                        { id: 'sibling', name: 'Sibling' },
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
  );
}
