import { useState, useEffect, FormEvent } from 'react';
import { createYouth, getSchools } from '../api/youth.api';
import { getErrorMessage } from '../../../common/utils/errors';
import { getToken } from '../../../common/utils/storage';
import Modal from '../../../common/components/Modal/Modal';
import './AddYouthModal.css';

interface School {
  id: string;
  name: string;
  schoolType: string;
  board: string | null;
}

interface AddYouthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddYouthModal({ isOpen, onClose, onSuccess }: AddYouthModalProps) {
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      getSchools(getToken())
        .then(setSchools)
        .catch(() => {}); // Schools dropdown is optional
    }
  }, [isOpen]);

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
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await createYouth(getToken(), {
        firstName,
        lastName,
        active,
        ...(dateOfBirth && { dateOfBirth }),
        ...(schoolId && { schoolId }),
        ...(gradeLevel && { gradeLevel }),
        ...(address && {
          address: {
            address,
            city,
            province,
            postalCode,
          },
        }),
        ...(contactFirstName && {
          contact: {
            firstName: contactFirstName,
            lastName: contactLastName,
            phoneNumber: contactPhone,
            type: contactType,
          },
        }),
      });
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create youth profile'));
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <button type="button" className="btn-cancel" onClick={handleClose}>
        Cancel
      </button>
      <button type="submit" form="add-youth-form" className="btn-submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Add Youth'}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Youth" footer={footer}>
      <form id="add-youth-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

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
