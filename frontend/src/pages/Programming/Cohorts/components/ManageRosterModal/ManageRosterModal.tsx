import { useMemo, useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';
import { withdrawYouth } from '../../../../../common/features/programming/api/programming.api';
import { useConfirmModal, type ConfirmAction } from '../../../../../common/components/Modal/hooks/useConfirmModal';
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
  const { enrolledYouth, search, setSearch, filterBySearch, loading, error, refresh } = useCohortRoster(cohort);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const visibleYouth = useMemo(() => filterBySearch(enrolledYouth), [enrolledYouth, filterBySearch]);

  const requestWithdrawal = (profile: YouthProfile) => {
    if (!cohort) return;
    setConfirmAction({
      title: 'Withdraw Youth',
      message: `Withdraw ${profile.firstName} ${profile.lastName} from ${cohort.programName} - ${cohort.name}? Their existing attendance history will be kept.`,
      confirmLabel: 'Withdraw',
      confirmVariant: 'danger',
      successMessage: `${profile.firstName} ${profile.lastName} successfully withdrawn.`,
      onConfirm: async () => {
        await withdrawYouth(cohort.id, profile.id);
        await refresh();
        await onSuccess();
      },
    });
  };

  return (
    <>
      <Modal
        isOpen={cohort !== null && !addingYouth}
        onClose={onClose}
        title={cohort ? `${cohort.programName} - ${cohort.name} Roster` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={() => setAddingYouth(true)}>Add youth</Button>
          </>
        )}
      >
        {error && <p className="form-error">{error}</p>}
        <SearchInput
          label="Search enrolled youth"
          value={search}
          onChange={event => setSearch(event.target.value)}
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

      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
    </>
  );
}
