import { useState, useEffect, FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { setYouth, getYouth } from '../api/youth.api';
import { getErrorMessage } from '../../../common/utils/errors';
import { getToken } from '../../../common/utils/storage';
import Modal from '../../../common/components/Modal/Modal';
import { useSchools } from '../../../common/hooks/useSchools';
import type { YouthProfile } from '../../../common/hooks/useYouth';
import './YouthModal.css';

interface Address {
  id: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  type: 'parent' | 'sibling' | 'guardian';
}

interface YouthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
  youthData?: YouthProfile;
}

export default function YouthModal({ isOpen, onClose, onSuccess, youthData }: YouthModalProps) {
  // Basic youth info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [active, setActive] = useState(true);

  // Addresses (array-based) - starts with one empty item
  const [addresses, setAddresses] = useState<Address[]>([
    { id: '', address: '', city: '', province: '', postalCode: '' }
  ]);
  const [showAddressesSection, setShowAddressesSection] = useState(false);

  // Contacts (array-based) - starts with one empty item
  const [contacts, setContacts] = useState<Contact[]>([
    { id: '', firstName: '', lastName: '', phoneNumber: '', type: 'parent' }
  ]);
  const [showContactsSection, setShowContactsSection] = useState(false);

  const { schools } = useSchools();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (!isOpen || !youthData) return;

    setFirstName(youthData.firstName || '');
    setLastName(youthData.lastName || '');
    setDateOfBirth(youthData.dateOfBirth ? youthData.dateOfBirth.split('T')[0] : '');
    setSchoolId(youthData.schoolId || '');
    setGradeLevel(youthData.gradeLevel || '');
    setActive(youthData.active ?? true);

    // Load existing addresses (or keep default empty one)
    if (youthData.addresses && youthData.addresses.length > 0) {
      setAddresses(youthData.addresses.map(addr => ({
        id: addr.id,
        address: addr.address,
        city: addr.city,
        province: addr.province,
        postalCode: addr.postalCode,
      })));
    } else {
      setAddresses([{ id: '', address: '', city: '', province: '', postalCode: '' }]);
    }

    // Load existing contacts (or keep default empty one)
    if (youthData.contacts && youthData.contacts.length > 0) {
      setContacts(youthData.contacts.map(cont => ({
        id: cont.id,
        firstName: cont.firstName,
        lastName: cont.lastName,
        phoneNumber: cont.phoneNumber || '',
        type: (cont.type as 'parent' | 'sibling' | 'guardian') || 'parent',
      })));
    } else {
      setContacts([{ id: '', firstName: '', lastName: '', phoneNumber: '', type: 'parent' }]);
    }
  }, [isOpen, youthData]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setSchoolId('');
    setGradeLevel('');
    setActive(true);
    
    setAddresses([{ id: '', address: '', city: '', province: '', postalCode: '' }]);
    setContacts([{ id: '', firstName: '', lastName: '', phoneNumber: '', type: 'parent' }]);

    setError('');
    setSubmitStatus('idle');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Address handlers
  const handleAddAddress = () => {
    setAddresses([...addresses, { id: '', address: '', city: '', province: '', postalCode: '' }]);
  };

  const handleDeleteAddress = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const handleAddressChange = (index: number, field: keyof Address, value: string) => {
    const updated = [...addresses];
    updated[index] = { ...updated[index], [field]: value };
    setAddresses(updated);
  };

  // Contact handlers
  const handleAddContact = () => {
    setContacts([...contacts, { id: '', firstName: '', lastName: '', phoneNumber: '', type: 'parent' }]);
  };

  const handleDeleteContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    setError('');

    const token = getToken();

    // Validate youth names
    const namePattern = /^[a-zA-Z\s'-]+$/;
    if (!namePattern.test(firstName.trim())) {
      setError('First name can only contain letters, spaces, hyphens, and apostrophes');
      setSubmitStatus('error');
      return;
    }

    if (!namePattern.test(lastName.trim())) {
      setError('Last name can only contain letters, spaces, hyphens, and apostrophes');
      setSubmitStatus('error');
      return;
    }

    // Validate addresses: if any field is filled, all required fields must be filled
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const hasAnyField = addr.address.trim() || addr.city.trim() || addr.province.trim() || addr.postalCode.trim();
      
      if (hasAnyField) {
        if (!addr.address.trim()) {
          setError(`Address ${i + 1}: Street address is required`);
          setSubmitStatus('error');
          return;
        }
        if (!addr.city.trim()) {
          setError(`Address ${i + 1}: City is required`);
          setSubmitStatus('error');
          return;
        }
        if (!addr.province.trim()) {
          setError(`Address ${i + 1}: Province is required`);
          setSubmitStatus('error');
          return;
        }
        if (!addr.postalCode.trim()) {
          setError(`Address ${i + 1}: Postal code is required`);
          setSubmitStatus('error');
          return;
        }
      }
    }

    // Validate contacts: if any field is filled, first and last name must be filled
    for (let i = 0; i < contacts.length; i++) {
      const cont = contacts[i];
      const hasAnyField = cont.firstName.trim() || cont.lastName.trim() || cont.phoneNumber.trim();
      
      if (hasAnyField) {
        if (!cont.firstName.trim()) {
          setError(`Contact ${i + 1}: First name is required`);
          setSubmitStatus('error');
          return;
        }
        if (!cont.lastName.trim()) {
          setError(`Contact ${i + 1}: Last name is required`);
          setSubmitStatus('error');
          return;
        }
        // Validate name pattern for contacts
        if (!namePattern.test(cont.firstName.trim())) {
          setError(`Contact ${i + 1}: First name can only contain letters, spaces, hyphens, and apostrophes`);
          setSubmitStatus('error');
          return;
        }
        if (!namePattern.test(cont.lastName.trim())) {
          setError(`Contact ${i + 1}: Last name can only contain letters, spaces, hyphens, and apostrophes`);
          setSubmitStatus('error');
          return;
        }
      }
    }

    try {
      // Filter out empty addresses (all fields empty)
      const nonEmptyAddresses = addresses.filter(addr => 
        addr.address.trim() || addr.city.trim() || addr.province.trim() || addr.postalCode.trim()
      );

      // Filter out empty contacts (no first/last name)
      const nonEmptyContacts = contacts.filter(cont => 
        cont.firstName.trim() || cont.lastName.trim()
      );

      const payload = {
        ...(youthData && { id: youthData.id }),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        active,
        ...(dateOfBirth && { dateOfBirth }),
        ...(schoolId && { schoolId }),
        ...(gradeLevel.trim() && { gradeLevel: gradeLevel.trim() }),
        // Always send addresses array (even if empty) to trigger backend delete when updating
        addresses: nonEmptyAddresses.map(addr => ({
          ...(addr.id && { id: addr.id }), // Include ID if it exists (for update)
          address: addr.address.trim(),
          city: addr.city.trim(),
          province: addr.province.trim(),
          postalCode: addr.postalCode.trim(),
        })),
        // Always send contacts array (even if empty) to trigger backend delete when updating
        contacts: nonEmptyContacts.map(cont => ({
          ...(cont.id && { id: cont.id }), // Include ID if it exists (for update)
          firstName: cont.firstName.trim(),
          lastName: cont.lastName.trim(),
          phoneNumber: cont.phoneNumber.trim(),
          type: cont.type,
        })),
      };

      const result = await setYouth(token, payload);

      // Fetch full profile
      const savedYouth = await getYouth(token, result.id);

      setSubmitStatus('success');
      
      setTimeout(() => {
        resetForm();
        onSuccess(savedYouth);
      }, 800);
    } catch (err: unknown) {
      setError(getErrorMessage(err, youthData ? 'Failed to update youth profile' : 'Failed to create youth profile'));
      setSubmitStatus('error');
    }
  };

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
      <form id="youth-form" onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="firstName">First Name *</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="lastName">Last Name *</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="dateOfBirth">Date of Birth</label>
            <input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="gradeLevel">Grade Level</label>
            <input
              id="gradeLevel"
              type="text"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="e.g. Grade 5"
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="school">School</label>
          <select
            id="school"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
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
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>Active (currently participating in cohort)</span>
          </label>
        </div>

        {/* Addresses Section */}
        <div className="section-divider">
          <div className="section-header" onClick={() => setShowAddressesSection(!showAddressesSection)}>
            <h3>Addresses</h3>
            <span className="chevron">{showAddressesSection ? '▲' : '▼'}</span>
          </div>
          
          {showAddressesSection && (
            <div className="section-content">
              {addresses.map((addr, index) => (
                <div key={index} className="address-form-item">
                  <div className="form-item-header">
                    <span className="form-item-label">Address {index + 1}</span>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleDeleteAddress(index)}
                      aria-label="Delete address"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      Delete
                    </button>
                  </div>
                  
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
              
              <button
                type="button"
                className="btn-add"
                onClick={handleAddAddress}
              >
                + Add Address
              </button>
            </div>
          )}
        </div>

        {/* Contacts Section */}
        <div className="section-divider">
          <div className="section-header" onClick={() => setShowContactsSection(!showContactsSection)}>
            <h3>Emergency Contacts</h3>
            <span className="chevron">{showContactsSection ? '▲' : '▼'}</span>
          </div>
          
          {showContactsSection && (
            <div className="section-content">
              {contacts.map((cont, index) => (
                <div key={index} className="contact-form-item">
                  <div className="form-item-header">
                    <span className="form-item-label">Contact {index + 1}</span>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleDeleteContact(index)}
                      aria-label="Delete contact"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      Delete
                    </button>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`firstName-${index}`}>First Name</label>
                      <input
                        id={`firstName-${index}`}
                        type="text"
                        value={cont.firstName}
                        onChange={(e) => handleContactChange(index, 'firstName', e.target.value)}
                        placeholder="John"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`lastName-${index}`}>Last Name</label>
                      <input
                        id={`lastName-${index}`}
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
              
              <button
                type="button"
                className="btn-add"
                onClick={handleAddContact}
              >
                + Add Emergency Contact
              </button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
