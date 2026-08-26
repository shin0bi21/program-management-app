import { useEffect, useMemo, useState } from 'react';

import Button from '../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import Modal from '../../../../../common/components/Modal/Modal';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';

import { withdrawYouth } from '../../../../../common/features/programming/api/cohorts.api';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import type { YouthProfile } from '../../../../../common/types/youth';

import { useCohortRoster } from '../../hooks/useCohortRoster';
import EnrollYouthModal from '../EnrollYouthModal/EnrollYouthModal';

import './ManageRosterModal.css';

interface ManageRosterModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function ManageRosterModal({ cohort, onClose, onSuccess }: ManageRosterModalProps) {
  const [addingYouth, setAddingYouth] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const cohortId = cohort?.id;

  const {
    enrolledYouth, search, setSearch, appliedSearch, applySearch, clearSearch,
    filterBySearch, loading, error, refresh,
  } = useCohortRoster(cohort);
  const visibleYouth = useMemo(() => filterBySearch(enrolledYouth), [enrolledYouth, filterBySearch]);

  useEffect(() => {
    setAddingYouth(false);
    setConfirmAction(null);
    setRefreshError('');
  }, [cohortId]);

  const requestWithdrawal = (profile: YouthProfile) => {
    if (!cohort) return;

    setRefreshError('');
    setConfirmAction({
      title: 'Withdraw Youth',
      message: `Withdraw ${profile.firstName} ${profile.lastName} from ${cohort.programName} - ${cohort.name}? Their existing attendance history will be kept.`,
      confirmLabel: 'Withdraw',
      confirmVariant: 'danger',
      successMessage: `${profile.firstName} ${profile.lastName} successfully withdrawn.`,
      onConfirm: async () => {
        await withdrawYouth(cohort.id, profile.id);
        try {
          await Promise.all([refresh(), onSuccess()]);
        } catch {
          setRefreshError('Youth was withdrawn, but the roster could not refresh. Reload to see it.');
        }
      },
    });
  };

  return (
    <>
      <Modal
        isOpen={cohort !== null && !addingYouth && confirmAction === null}
        onClose={onClose}
        title={cohort ? `${cohort.programName} - ${cohort.name} Roster` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={() => setAddingYouth(true)}>Add Youth</Button>
          </>
        )}
      >
        {(error || refreshError) && (
          <p className="form-error" role="alert">{error || refreshError}</p>
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
              <Button size="sm" variant="ghost" onClick={() => requestWithdrawal(profile)}>Withdraw</Button>
            </div>
          )) : (
            <p className="page-empty">{enrolledYouth.length ? 'No enrolled youth match your search.' : 'No youth are currently enrolled.'}</p>
          )}
        </div>
      </Modal>

      <EnrollYouthModal
        cohort={addingYouth ? cohort : null}
        onClose={() => setAddingYouth(false)}
        onSuccess={async () => { await refresh(); await onSuccess(); }}
      />

      <ConfirmModal
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </>
  );
}
