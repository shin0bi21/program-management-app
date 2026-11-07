import type { RosterMutationResult } from '../../api/programCycleAssignments.api';
import { useMemo } from 'react';

import Button from '../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';
import Modal from '../../../../../common/components/Modal/Modal';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';
import type { ProgramCycleAssignment } from '../../types';

import { useProgramRoster } from './hooks/useProgramRoster';
import { useManageRosterModal } from './hooks/useManageRosterModal';

import './ManageRosterModal.css';

interface ManageRosterModalProps {
  assignment: ProgramCycleAssignment | null;
  onClose: () => void;
  onSuccess: (result: RosterMutationResult) => void | Promise<void>;
}

export default function ManageRosterModal({ assignment, onClose, onSuccess }: ManageRosterModalProps) {
  const {
    youth, search, setSearch, appliedSearch, applySearch, clearSearch,
    filterYouth, loading, error, refresh,
  } = useProgramRoster(assignment);
  const visibleYouth = useMemo(() => filterYouth(youth), [filterYouth, youth]);
  const workflow = useManageRosterModal({ assignment, refresh, onSuccess });

  const isEnrolled = (profile: typeof youth[number]) => profile.programCycles.some(
    enrollment => enrollment.programId === assignment?.programId && enrollment.cycleId === assignment?.cycleId && enrollment.withdrawnOn === null,
  );

  return (
    <>
      <Modal
        isOpen={assignment !== null && workflow.confirmAction === null}
        onClose={onClose}
        title={assignment ? `${assignment.program} - ${assignment.cycle} Roster` : ''}
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
            className="manage-roster-search"
            label="Search youth"
            value={search}
            appliedValue={appliedSearch}
            onChange={event => setSearch(event.target.value)}
            onApply={applySearch}
            onClear={clearSearch}
            placeholder="Search by name or school"
          />
          <fieldset className="manage-roster-age-filter" aria-describedby="roster-age-help">
            <legend>Min/max age</legend>
            <div className="manage-roster-age-filter__fields">
              <label htmlFor="roster-minimum-age">
                Minimum age
                <input
                  id="roster-minimum-age"
                  type="number"
                  value={assignment?.minAge ?? ''}
                  placeholder="Any"
                  readOnly
                  disabled
                />
              </label>
              <label htmlFor="roster-maximum-age">
                Maximum age
                <input
                  id="roster-maximum-age"
                  type="number"
                  value={assignment?.maxAge ?? ''}
                  placeholder="Any"
                  readOnly
                  disabled
                />
              </label>
            </div>
            <p id="roster-age-help" className="manage-roster-age-filter__help">
              Age limits are set on the program.
            </p>
          </fieldset>
        </div>
        <div className="manage-roster-list" aria-label="Program cycle roster">
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
                  Age {profile.age ?? '—'}
                  {profile.schoolName ? ` · ${profile.schoolName}` : ''}
                </small>
              </span>
            </label>
          )) : !error && (
            <p className="page-empty">{youth.length ? 'No youth match your search.' : 'No eligible youth found.'}</p>
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
