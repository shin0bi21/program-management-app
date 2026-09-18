import { useMemo } from 'react';

import Button from '../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';
import Modal from '../../../../../common/components/Modal/Modal';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';
import { calculateAge } from '../../../../../common/utils/time';

import type { ProgramCohort } from '../../types';

import { useCohortRoster } from '../../hooks/useCohortRoster';
import { useManageRosterModal } from './hooks/useManageRosterModal';

import './ManageRosterModal.css';

interface ManageRosterModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function ManageRosterModal({ cohort, onClose, onSuccess }: ManageRosterModalProps) {
  const {
    youth, search, setSearch, appliedSearch, applySearch, clearSearch,
    minimumAge, setMinimumAge, maximumAge, setMaximumAge,
    filterYouth, loading, error, refresh,
  } = useCohortRoster(cohort);
  const visibleYouth = useMemo(() => filterYouth(youth), [filterYouth, youth]);
  const workflow = useManageRosterModal({ cohort, refresh, onSuccess });

  const isEnrolled = (profile: typeof youth[number]) => profile.cohorts.some(
    enrollment => enrollment.id === cohort?.id && enrollment.withdrawnOn === null,
  );

  return (
    <>
      <Modal
        isOpen={cohort !== null && workflow.confirmAction === null}
        onClose={onClose}
        title={cohort ? `${cohort.programName} - ${cohort.name} Roster` : ''}
        disableClose={workflow.pendingYouthId !== null}
        footer={<Button
          variant="secondary"
          onClick={onClose}
          disabled={workflow.pendingYouthId !== null}
        >Close</Button>}
      >
        {(error || workflow.actionError) && (
          <p className="form-error" role="alert">{error || workflow.actionError}</p>
        )}
        <div className="manage-roster-controls">
          <SearchInput
            label="Search youth"
            value={search}
            appliedValue={appliedSearch}
            onChange={event => setSearch(event.target.value)}
            onApply={applySearch}
            onClear={clearSearch}
            placeholder="Search by name or school"
          />
          <fieldset className="manage-roster-age-filter">
            <legend>Filter by age</legend>
            <label htmlFor="roster-minimum-age">
              Minimum
              <input
                id="roster-minimum-age"
                type="number"
                min="0"
                value={minimumAge}
                onChange={event => setMinimumAge(event.target.value)}
                placeholder="Any"
              />
            </label>
            <label htmlFor="roster-maximum-age">
              Maximum
              <input
                id="roster-maximum-age"
                type="number"
                min="0"
                value={maximumAge}
                onChange={event => setMaximumAge(event.target.value)}
                placeholder="Any"
              />
            </label>
          </fieldset>
        </div>
        <div className="manage-roster-list" aria-label="Cohort roster">
          {loading ? (
            <p className="page-empty">Loading youth…</p>
          ) : visibleYouth.length ? visibleYouth.map(profile => (
            <label key={profile.id} className="manage-roster-list__item">
              <input
                type="checkbox"
                checked={isEnrolled(profile)}
                disabled={workflow.pendingYouthId !== null}
                onChange={() => {
                  if (isEnrolled(profile)) {
                    workflow.requestWithdrawal(profile);
                    return;
                  }
                  void workflow.addYouth(profile);
                }}
              />
              <span>
                <strong>{profile.firstName} {profile.lastName}</strong>
                <small>
                  Age {calculateAge(profile.dateOfBirth)}
                  {profile.schoolName ? ` · ${profile.schoolName}` : ''}
                </small>
              </span>
            </label>
          )) : (
            <p className="page-empty">{youth.length ? 'No youth match your search and filters.' : 'No youth profiles found.'}</p>
          )}
        </div>
      </Modal>

      <ConfirmModal
        action={workflow.confirmAction}
        onClose={workflow.closeConfirmation}
      />
    </>
  );
}
