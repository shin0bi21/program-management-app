import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';
import { enrollYouth } from '../../../../../common/api/cohorts.api';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import { getAge } from '../../../../../common/utils/time';
import { getErrorMessage } from '../../../../../common/utils/clientErrors';
import { useCohortRoster } from '../../hooks/useCohortRoster';
import './EnrollYouthModal.css';

interface EnrollYouthModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function EnrollYouthModal({ cohort, onClose, onSuccess }: EnrollYouthModalProps) {
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [ageFilterEnabled, setAgeFilterEnabled] = useState(true);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    youth,
    unenrolledYouth,
    search,
    setSearch,
    filterBySearch,
    loading,
    error: loadError,
  } = useCohortRoster(cohort);

  useEffect(() => {
    if (!cohort) return;
    setSelectedYouthIds([]);
    setAgeFilterEnabled(true);
    setSubmitStatus('idle');
    setSubmitError(null);
  }, [cohort]);

  const minAge = cohort?.minAge ?? null;
  const maxAge = cohort?.maxAge ?? null;
  const hasAgeRange = minAge !== null && maxAge !== null;
  const availableYouth = useMemo(() => {
    if (!ageFilterEnabled || minAge === null || maxAge === null) return unenrolledYouth;
    return unenrolledYouth.filter(profile => {
      const age = getAge(profile.dateOfBirth);
      return age !== null && age >= minAge && age <= maxAge;
    });
  }, [ageFilterEnabled, maxAge, minAge, unenrolledYouth]);

  const visibleYouth = useMemo(
    () => filterBySearch(availableYouth),
    [availableYouth, filterBySearch],
  );

  const toggleYouth = (youthId: string) => {
    setSelectedYouthIds(current => (
      current.includes(youthId)
        ? current.filter(id => id !== youthId)
        : [...current, youthId]
    ));
  };

  const setAgeFilter = (enabled: boolean) => {
    setAgeFilterEnabled(enabled);
    if (enabled && minAge !== null && maxAge !== null) {
      setSelectedYouthIds(selected => selected.filter(id => {
        const profile = youth.find(item => item.id === id);
        const age = getAge(profile?.dateOfBirth);
        return age !== null && age >= minAge && age <= maxAge;
      }));
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cohort || !selectedYouthIds.length) return;
    setSubmitStatus('submitting');
    setSubmitError(null);
    try {
      await enrollYouth(cohort.id, { youthIds: selectedYouthIds });
      await onSuccess();
      setSubmitStatus('success');
    } catch (cause) {
      setSubmitError(getErrorMessage(cause, 'Could not enroll youth'));
      setSubmitStatus('error');
    }
  };

  const selectedCount = selectedYouthIds.length;
  const cohortLabel = cohort ? `${cohort.programName} - ${cohort.name}` : '';
  let statusMessage = submitError ?? undefined;
  if (submitStatus === 'submitting') {
    statusMessage = `Adding ${selectedCount} youth to ${cohortLabel}...`;
  } else if (submitStatus === 'success') {
    statusMessage = `${selectedCount} youth successfully added to ${cohortLabel}.`;
  }

  let emptyMessage = 'All youth are already enrolled.';
  if (availableYouth.length) {
    emptyMessage = 'No youth match your search.';
  } else if (ageFilterEnabled && hasAgeRange && unenrolledYouth.length) {
    emptyMessage = `No available youth are ages ${minAge}–${maxAge}. Choose “All ages” to make an exception.`;
  }

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={cohort !== null}
      onClose={onClose}
      title={cohort ? `${cohort.programName} - ${cohort.name} Enrollment` : ''}
      status={submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={(
        <ModalFormFooter
          formId="enroll-youth-form"
          submitLabel={selectedYouthIds.length
            ? `Enroll ${selectedYouthIds.length} Youth`
            : 'Enroll Youth'}
          submitStatus={submitStatus}
          submitDisabled={loading || !selectedYouthIds.length}
          onClose={onClose}
        />
      )}
    >
      {loadError && <p className="form-error">{loadError}</p>}
      {submitError && submitStatus === 'idle' && <p className="form-error">{submitError}</p>}
      <form id="enroll-youth-form" onSubmit={event => void submit(event)}>
        {hasAgeRange && (
          <div
            className="enroll-youth-age-filter"
            role="group"
            aria-label="Youth age filter"
          >
            <Button
              size="sm"
              variant={!ageFilterEnabled ? 'primary' : 'secondary'}
              aria-pressed={!ageFilterEnabled}
              onClick={() => setAgeFilter(false)}
              disabled={submissionComplete}
            >
              All ages
            </Button>
            <Button
              size="sm"
              variant={ageFilterEnabled ? 'primary' : 'secondary'}
              aria-pressed={ageFilterEnabled}
              onClick={() => setAgeFilter(true)}
              disabled={submissionComplete}
            >
              Ages {minAge}–{maxAge}
            </Button>
          </div>
        )}

        <SearchInput
          label="Search youth"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search by name or school"
        />

        <div className="enroll-youth-checklist" aria-label="Youth available for enrollment">
          {loading ? (
            <p className="page-empty">Loading youth…</p>
          ) : visibleYouth.length ? visibleYouth.map(profile => (
            <label key={profile.id} className="enroll-youth-checklist__item">
              <input
                type="checkbox"
                checked={selectedYouthIds.includes(profile.id)}
                onChange={() => toggleYouth(profile.id)}
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
