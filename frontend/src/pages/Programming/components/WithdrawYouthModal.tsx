import { useMemo, useState } from 'react';
import Button from '../../../common/components/Button/Button';
import Modal from '../../../common/components/Modal/Modal';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import { withdrawYouth } from '../../../common/api/cohorts.api';
import { useConfirmModal, type ConfirmAction } from '../../../common/hooks/useConfirmModal';
import type { ProgramCohort } from '../../../common/types/cohort';
import type { YouthProfile } from '../../../common/types/youth';
import { useCohortRoster } from '../hooks/useCohortRoster';
import './WithdrawYouthModal.css';

interface WithdrawYouthModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function WithdrawYouthModal({
  cohort,
  onClose,
  onSuccess,
}: WithdrawYouthModalProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const {
    enrolledYouth,
    search,
    setSearch,
    filterBySearch,
    loading,
    error,
    refresh,
  } = useCohortRoster(cohort);
  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

  const visibleYouth = useMemo(
    () => filterBySearch(enrolledYouth),
    [enrolledYouth, filterBySearch],
  );

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
        isOpen={cohort !== null}
        onClose={onClose}
        title={cohort ? `${cohort.programName} - ${cohort.name} Withdrawal` : ''}
        footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      >
        {error && <p className="form-error">{error}</p>}
        <SearchInput
          label="Search enrolled youth"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search by name or school"
        />
        <div className="withdraw-youth-list" aria-label="Youth available for withdrawal">
          {loading ? (
            <p className="programming-empty">Loading youth…</p>
          ) : visibleYouth.length ? visibleYouth.map(profile => (
            <div key={profile.id} className="withdraw-youth-list__item">
              <span>
                <strong>{profile.firstName} {profile.lastName}</strong>
                {profile.schoolName && <small>{profile.schoolName}</small>}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => requestWithdrawal(profile)}
              >
                Withdraw
              </Button>
            </div>
          )) : (
            <p className="programming-empty">
              {enrolledYouth.length
                ? 'No enrolled youth match your search.'
                : 'No youth are currently enrolled.'}
            </p>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        disableClose={confirmModal.disableClose}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
    </>
  );
}
