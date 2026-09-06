import { useMemo } from 'react';

import Button from '../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';
import Modal from '../../../../../common/components/Modal/Modal';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';

import type { ProgramCohort } from '../../types';

import { useCohortRoster } from '../../hooks/useCohortRoster';
import EnrollYouthModal from '../EnrollYouthModal/EnrollYouthModal';
import { useManageRosterModal } from './hooks/useManageRosterModal';

import './ManageRosterModal.css';

interface ManageRosterModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function ManageRosterModal({ cohort, onClose, onSuccess }: ManageRosterModalProps) {
  const {
    enrolledYouth, search, setSearch, appliedSearch, applySearch, clearSearch,
    filterBySearch, loading, error, refresh,
  } = useCohortRoster(cohort);
  const visibleYouth = useMemo(() => filterBySearch(enrolledYouth), [enrolledYouth, filterBySearch]);
  const workflow = useManageRosterModal({ cohort, refresh, onSuccess });

  return (
    <>
      <Modal
        isOpen={cohort !== null && !workflow.addingYouth && workflow.confirmAction === null}
        onClose={onClose}
        title={cohort ? `${cohort.programName} - ${cohort.name} Roster` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={workflow.openEnrollment}>Add Youth</Button>
          </>
        )}
      >
        {(error || workflow.refreshError) && (
          <p className="form-error" role="alert">{error || workflow.refreshError}</p>
        )}
        <SearchInput
          label="Search enrolled youth"
          value={search}
          appliedValue={appliedSearch}
          onChange={event => setSearch(event.target.value)}
          onApply={applySearch}
          onClear={clearSearch}
          placeholder="Search by name or school"
        />
        <div className="manage-roster-list" aria-label="Current cohort roster">
          {loading ? (
            <p className="page-empty">Loading youth…</p>
          ) : visibleYouth.length ? visibleYouth.map(profile => (
            <div key={profile.id} className="manage-roster-list__item">
              <span>
                <strong>{profile.firstName} {profile.lastName}</strong>
                {profile.schoolName && <small>{profile.schoolName}</small>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => workflow.requestWithdrawal(profile)}>Withdraw</Button>
            </div>
          )) : (
            <p className="page-empty">{enrolledYouth.length ? 'No enrolled youth match your search.' : 'No youth are currently enrolled.'}</p>
          )}
        </div>
      </Modal>

      <EnrollYouthModal
        cohort={workflow.addingYouth ? cohort : null}
        onClose={workflow.closeEnrollment}
        onSuccess={workflow.enrollmentSucceeded}
      />

      <ConfirmModal
        action={workflow.confirmAction}
        onClose={workflow.closeConfirmation}
      />
    </>
  );
}
