import { useState, useEffect, FormEvent } from 'react';
import { setYouth, getYouth, getSchools } from '../api/youth.api';
import { getErrorMessage } from '../../../common/utils/errors';
import { getToken } from '../../../common/utils/storage';
import Modal from '../../../common/components/Modal/Modal';
import type { YouthProfile } from '../hooks/useYouth';
import './YouthModal.css';

interface School {
  id: string;
  name: string;
  schoolType: string;
  board: string | null;
}

interface YouthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (youthData: YouthProfile) => void;
  youthData?: YouthProfile;
}

export default function YouthModal({ isOpen, onClose, onSuccess, youthData }: YouthModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [active, setActive] = useState(true);

  const [showAddressFields, setShowAddressFields] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [showContactFields, setShowContactFields] = useState(false);
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactType, setContactType] = useState<'parent' | 'sibling' | 'guardian'>('parent');

  const [schools, setSchools] = useState<School[]>([]);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  // Fetch schools
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const token = getToken();

    getSchools(token)
      .then((data) => {
        if (!cancelled) setSchools(data);
      })
      .catch(() => {
        // Schools dropdown is optional
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Pre-fill form when editing
  useEffect(() => {
    if (!isOpen || !youthData) return;

    setFirstName(youthData.firstName || '');
    setLastName(youthData.lastName || '');
    // Extract YYYY-MM-DD from ISO date string (e.g., "2010-05-15T00:00:00.000Z" → "2010-05-15")
    setDateOfBirth(youthData.dateOfBirth ? youthData.dateOfBirth.split('T')[0] : '');
    setSchoolId(youthData.schoolId || '');
    setGradeLevel(youthData.gradeLevel || '');
    setActive(youthData.active ?? true);

    // Pre-fill address if exists
    if (youthData.addresses && youthData.addresses.length > 0) {
      const addr = youthData.addresses[0];
      setShowAddressFields(true);
      setAddress(addr.address || '');
      setCity(addr.city || '');
      setProvince(addr.province || '');
      setPostalCode(addr.postalCode || '');
    }

    // Pre-fill contact if exists
    if (youthData.contacts && youthData.contacts.length > 0) {
      const cont = youthData.contacts[0];
      setShowContactFields(true);
      setContactFirstName(cont.firstName || '');
      setContactLastName(cont.lastName || '');
      setContactPhone(cont.phoneNumber || '');
      setContactType((cont.type as 'parent' | 'sibling' | 'guardian') || 'parent');
    }
  }, [isOpen, youthData]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setSchoolId('');
    setGradeLevel('');
    setActive(true);

    setShowAddressFields(false);
    setAddress('');
    setCity('');
    setProvince('');
    setPostalCode('');

    setShowContactFields(false);
    setContactFirstName('');
    setContactLastName('');
    setContactPhone('');
    setContactType('parent');

    setError('');
    setSubmitStatus('idle');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    setError('');

    const token = getToken();

    // Validate names contain only letters, spaces, hyphens, and apostrophes
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

    const hasAnyAddress =
      address.trim() || city.trim() || province.trim() || postalCode.trim();
    
    const hasCompleteAddress =
      address.trim() && city.trim() && province.trim() && postalCode.trim();

    const hasAnyContact =
      contactFirstName.trim() || contactLastName.trim() || contactPhone.trim();

    const hasCompleteContact =
      contactFirstName.trim() && contactLastName.trim();

    // Validate partial data
    if (hasAnyAddress && !hasCompleteAddress) {
      setError('Please complete all address fields (street, city, province, postal code) or leave them all empty');
      setSubmitStatus('error');
      return;
    }

    if (hasAnyContact && !hasCompleteContact) {
      setError('Please provide at least first name and last name for the emergency contact or leave all fields empty');
      setSubmitStatus('error');
      return;
    }

    // Validate contact names if provided
    if (hasCompleteContact) {
      if (!namePattern.test(contactFirstName.trim())) {
        setError('Contact first name can only contain letters, spaces, hyphens, and apostrophes');
        setSubmitStatus('error');
        return;
      }

      if (!namePattern.test(contactLastName.trim())) {
        setError('Contact last name can only contain letters, spaces, hyphens, and apostrophes');
        setSubmitStatus('error');
        return;
      }
    }

    try {
      const result = await setYouth(token, {
        ...(youthData && { id: youthData.id }),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        active,

        ...(dateOfBirth && { dateOfBirth }),
        ...(schoolId && { schoolId }),
        ...(gradeLevel.trim() && { gradeLevel: gradeLevel.trim() }),

        ...(hasCompleteAddress && {
          address: {
            address: address.trim(),
            city: city.trim(),
            province: province.trim(),
            postalCode: postalCode.trim(),
          },
        }),

        ...(hasCompleteContact && {
          contact: {
            firstName: contactFirstName.trim(),
            lastName: contactLastName.trim(),
            phoneNumber: contactPhone.trim(),
            type: contactType,
          },
        }),
      });

      // Fetch full profile using existing method
      const savedYouth = await getYouth(token, result.id);

      setSubmitStatus('success');
      
      // Show success message briefly, then close
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

        <div className="form-field">
          <button
            type="button"
            className="btn-toggle"
            onClick={() => setShowAddressFields(!showAddressFields)}
          >
            {showAddressFields ? 'Hide Address' : 'Add Address'}
          </button>
        </div>

        {showAddressFields && (
          <div className="address-section">
            <div className="form-field">
              <label htmlFor="address">Street Address</label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Toronto"
                />
              </div>
              <div className="form-field">
                <label htmlFor="province">Province</label>
                <input
                  id="province"
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="ON"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="postalCode">Postal Code</label>
              <input
                id="postalCode"
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="A1A 1A1"
              />
            </div>
          </div>
        )}

        <div className="form-field">
          <button
            type="button"
            className="btn-toggle"
            onClick={() => setShowContactFields(!showContactFields)}
          >
            {showContactFields ? 'Hide Emergency Contact' : 'Add Emergency Contact'}
          </button>
        </div>

        {showContactFields && (
          <div className="contact-section">
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="contactFirstName">First Name</label>
                <input
                  id="contactFirstName"
                  type="text"
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="form-field">
                <label htmlFor="contactLastName">Last Name</label>
                <input
                  id="contactLastName"
                  type="text"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="contactPhone">Phone Number</label>
                <input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="(416) 555-1234"
                />
              </div>
              <div className="form-field">
                <label htmlFor="contactType">Relationship</label>
                <select
                  id="contactType"
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value as 'parent' | 'sibling' | 'guardian')}
                >
                  <option value="parent">Parent</option>
                  <option value="guardian">Guardian</option>
                  <option value="sibling">Sibling</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
