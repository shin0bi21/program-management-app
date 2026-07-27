import { useEffect, useMemo, useState } from 'react';
import Button from '../../../common/components/Button/Button';
import Modal from '../../../common/components/Modal/Modal';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import { withdrawYouth } from '../../../common/api/cohorts.api';
import { getYouth } from '../../../common/api/youth.api';
import { useConfirmModal, type ConfirmAction } from '../../../common/hooks/useConfirmModal';
import type { ProgramCohort } from '../../../common/types/cohort';
import type { YouthProfile } from '../../../common/types/youth';
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
  const [youth, setYouth] = useState<YouthProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

  useEffect(() => {
    if (!cohort) return;
    let active = true;
    setSearch('');
    setLoading(true);
    setError(null);
    setConfirmAction(null);
    getYouth()
      .then(data => {
        if (active) setYouth(data);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load youth');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cohort]);

  const enrolledYouth = useMemo(
    () => cohort
      ? youth.filter(profile => profile.cohorts.some(enrollment => (
        enrollment.id === cohort.id && enrollment.withdrawnOn === null
      )))
      : [],
    [cohort, youth],
  );

  const visibleYouth = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enrolledYouth;
    return enrolledYouth.filter(profile => (
      `${profile.firstName} ${profile.lastName}`.toLowerCase().includes(query)
      || profile.schoolName?.toLowerCase().includes(query)
    ));
  }, [enrolledYouth, search]);

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
        const refreshedYouth = await getYouth();
        setYouth(refreshedYouth);
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
