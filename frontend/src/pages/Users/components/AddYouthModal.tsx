import { useState, useEffect, FormEvent } from 'react';
import { createYouth, getSchools } from '../api/youth.api';
import { getErrorMessage } from '../../../common/utils/errors';
import { getToken } from '../../../common/utils/storage';
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
        ...(dateOfBirth && { dateOfBirth }),
        ...(schoolId && { schoolId }),
        ...(gradeLevel && { gradeLevel }),
      });
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create youth profile'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Youth</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-form-row">
            <div className="modal-field">
              <label htmlFor="firstName">First Name *</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="modal-field">
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

          <div className="modal-form-row">
            <div className="modal-field">
              <label htmlFor="dateOfBirth">Date of Birth</label>
              <input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="modal-field">
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

          <div className="modal-field">
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

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn-submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Add Youth'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
