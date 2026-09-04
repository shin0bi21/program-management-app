import type { FormEvent } from 'react';

import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';

import type { ProgramCohort } from '../../types';

import { useCohortRoster } from '../../hooks/useCohortRoster';
import {
  getEnrollmentEmptyMessage,
  getEnrollmentStatusMessage,
} from './enrollYouthModal.utils';
import { useEnrollYouthSubmit } from './hooks/useEnrollYouthSubmit';
import { useYouthEnrollmentSelection } from './hooks/useYouthEnrollmentSelection';

import './EnrollYouthModal.css';

interface EnrollYouthModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function EnrollYouthModal({
  cohort,
  onClose,
  onSuccess,
}: EnrollYouthModalProps) {
  const {
    unenrolledYouth,
    search,
    setSearch,
    appliedSearch,
    applySearch,
    clearSearch,
    filterBySearch,
    loading,
    error: loadError,
  } = useCohortRoster(cohort);

  const selection = useYouthEnrollmentSelection(cohort, unenrolledYouth);

  const submission = useEnrollYouthSubmit({
    cohortId: cohort?.id,
    selectedYouthIds: selection.selectedYouthIds,
    onSuccess,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submission.submit();
  };

  const visibleYouth = filterBySearch(selection.availableYouth);
  const cohortLabel = cohort ? `${cohort.programName} - ${cohort.name}` : '';

  const statusMessage = getEnrollmentStatusMessage(
    submission.submitStatus,
    submission.submitError,
    selection.selectedCount,
    cohortLabel,
  );

  const emptyMessage = getEnrollmentEmptyMessage({
    availableCount: selection.availableYouth.length,
    unenrolledCount: unenrolledYouth.length,
    ageFilterEnabled: selection.ageFilterEnabled,
    hasAgeRange: selection.hasAgeRange,
    minAge: selection.minAge,
    maxAge: selection.maxAge,
  });
  const submissionComplete = submission.submitStatus === 'submitting'
    || submission.submitStatus === 'success';

  return (
    <Modal
      isOpen={cohort !== null}
      onClose={onClose}
      title={cohort ? `${cohort.programName} - ${cohort.name} Enrollment` : ''}
      status={submission.submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      footer={(
        <ModalFormFooter
          formId="enroll-youth-form"
          submitLabel={selection.selectedCount
            ? `Enroll ${selection.selectedCount} Youth`
            : 'Enroll Youth'}
          submitStatus={submission.submitStatus}
          submitDisabled={loading || !selection.selectedCount}
          onClose={onClose}
        />
      )}
    >
      {loadError && <p className="form-error">{loadError}</p>}
      <form id="enroll-youth-form" onSubmit={handleSubmit}>
        {selection.hasAgeRange && (
          <div
            className="enroll-youth-age-filter"
            role="group"
            aria-label="Youth age filter"
          >
            <Button
              size="sm"
              variant={!selection.ageFilterEnabled ? 'primary' : 'secondary'}
              aria-pressed={!selection.ageFilterEnabled}
              onClick={() => selection.setAgeFilter(false)}
              disabled={submissionComplete}
            >
              All ages
            </Button>
            <Button
              size="sm"
              variant={selection.ageFilterEnabled ? 'primary' : 'secondary'}
              aria-pressed={selection.ageFilterEnabled}
              onClick={() => selection.setAgeFilter(true)}
              disabled={submissionComplete}
            >
              Ages {selection.minAge}–{selection.maxAge}
            </Button>
          </div>
        )}

        <SearchInput
          label="Search youth"
          value={search}
          appliedValue={appliedSearch}
          onChange={event => setSearch(event.target.value)}
          onApply={applySearch}
          onClear={clearSearch}
          placeholder="Search by name or school"
          disabled={submissionComplete}
        />

        <div className="enroll-youth-checklist" aria-label="Youth available for enrollment">
          {loading ? (
            <p className="page-empty">Loading youth…</p>
          ) : visibleYouth.length ? visibleYouth.map(profile => (
            <label key={profile.id} className="enroll-youth-checklist__item">
              <input
                type="checkbox"
                checked={selection.selectedYouthIds.includes(profile.id)}
                onChange={() => selection.toggleYouth(profile.id)}
                disabled={submissionComplete}
              />
              <span>
                <strong>{profile.firstName} {profile.lastName}</strong>
                {profile.schoolName && <small>{profile.schoolName}</small>}
              </span>
            </label>
          )) : (
            <p className="page-empty">{emptyMessage}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
