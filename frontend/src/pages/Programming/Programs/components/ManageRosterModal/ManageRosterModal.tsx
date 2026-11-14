import type { RosterMutationResult } from '../../api/programCycleAssignments.api';
import { useMemo } from 'react';

import Button from '../../../../../common/components/Button/Button';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
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

/**
 * Mounts the selected roster interaction and discards its state when closed.
 * @param props - Loaded assignment and roster completion actions.
 * @example <ManageRosterModal assignment={assignment} onClose={close} onSuccess={sync} />
 */
export default function ManageRosterModal({ assignment, ...props }: ManageRosterModalProps) {
  return assignment ? <Roster key={`${assignment.programId}:${assignment.cycleId}`} assignment={assignment} {...props} /> : null;
}

/**
 * Waits for roster data before mounting its state-owning form.
 * @param props - Selected assignment and completion actions.
 * @example A failed initial lookup shows Retry without creating an empty enrollment draft.
 */
function Roster(props: Omit<ManageRosterModalProps, 'assignment'> & { assignment: ProgramCycleAssignment }) {
  const roster = useProgramRoster(props.assignment);
  if (!roster.ready) {
    return <Modal isOpen onClose={props.onClose} title={`${props.assignment.program} - ${props.assignment.cycle} Roster`}>
      {roster.error
        ? <p role="alert">{roster.error} <Button onClick={() => { void roster.refresh().catch(() => undefined); }}>Retry</Button></p>
        : <p className="page-empty">Loading youth…</p>}
    </Modal>;
  }
  return <RosterForm {...props} roster={roster} />;
}

/**
 * Edits a mounted roster selection and submits it through the modal's Save action.
 * @param props - Loaded roster choices, assignment, and completion actions.
 * @example Unchecking a member changes only the local draft until Save is pressed.
 */
function RosterForm({ assignment, onClose, onSuccess, roster }: Omit<ManageRosterModalProps, 'assignment'> & {
  assignment: ProgramCycleAssignment;
  roster: ReturnType<typeof useProgramRoster>;
}) {
  const { youth, appliedSearch, setAppliedSearch, filterYouth, error, refresh } = roster;
  const visibleYouth = useMemo(() => filterYouth(youth), [filterYouth, youth]);
  const workflow = useManageRosterModal({ assignment, youth, refresh, onSuccess });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${assignment.program} - ${assignment.cycle} Roster`}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      footer={<ModalFormFooter formId="manage-roster-form" submitStatus={workflow.submitStatus} onClose={onClose} />}
    >
      <form id="manage-roster-form" onSubmit={event => {
        event.preventDefault();
        void workflow.submit();
      }} aria-busy={workflow.locked}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="manage-roster-controls">
          <SearchInput
            className="manage-roster-search"
            label="Search youth"
            disabled={workflow.locked}
            appliedValue={appliedSearch}
            onApply={setAppliedSearch}
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
                  value={assignment.minAge ?? ''}
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
                  value={assignment.maxAge ?? ''}
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
          {visibleYouth.map(profile => (
            <label key={profile.id} className="manage-roster-list__item">
              <input
                type="checkbox"
                checked={workflow.selectedYouthIds.includes(profile.id)}
                disabled={workflow.locked}
                onChange={() => workflow.toggleYouth(profile.id)}
              />
              <span>
                <strong>{profile.firstName} {profile.lastName}</strong>
                <small>
                  Age {profile.age ?? '—'}
                  {profile.schoolName ? ` · ${profile.schoolName}` : ''}
                </small>
              </span>
            </label>
          ))}
          {visibleYouth.length === 0 && !error && (
            <p className="page-empty">{youth.length ? 'No youth match your search.' : 'No eligible youth found.'}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
