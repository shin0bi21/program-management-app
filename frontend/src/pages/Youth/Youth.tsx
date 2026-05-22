import { useState, useMemo } from 'react';
import Button from '../../common/components/Button/Button';
import Header from '../../common/components/Header/Header';
import Modal from '../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../common/components/Table/Table';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import { useYouth, YouthProfile } from './hooks/useYouth';
import YouthModal from './components/YouthModal/YouthModal';
import { useAuth } from '../../common/context/AuthContext';
import { useConfirmModal } from '../../common/hooks/useConfirmModal';
import { toggleYouthActive } from './api/youth.api';
import './Youth.css';

function calculateAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
}

type ConfirmAction =
  | { type: 'deactivate'; profile: YouthProfile }
  | { type: 'reactivate'; profile: YouthProfile };

function confirmLabel(action: ConfirmAction): string {
  const name = `${action.profile.firstName} ${action.profile.lastName}`;
  if (action.type === 'deactivate') return `Deactivate ${name}? They will lose access to the system immediately.`;
  return `Reactivate ${name}? They will regain access to the system.`;
}

export default function Youth() {
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const { youth, setYouth, loading, error } = useYouth();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleToggle = async () => {
    if (!confirmAction) return;
    const updated = await toggleYouthActive(confirmAction.profile.id);
    setYouth(prev => prev.map(y => y.id === updated.id ? updated : y));
  };

  const confirmModal = useConfirmModal({
    isOpen: !!confirmAction,
    onConfirm: handleToggle,
    onClose: () => setConfirmAction(null),
    confirmLabel: confirmAction?.type === 'deactivate' ? 'Deactivate' : 'Reactivate',
    confirmVariant: confirmAction?.type === 'deactivate' ? 'danger' : 'primary',
    successMessage: confirmAction?.type === 'deactivate' ? 'Profile deactivated' : 'Profile reactivated',
  });

  const youthColumns = useMemo<TableColumn<YouthProfile>[]>(() => [
    {
      key: 'firstName',
      header: 'First Name',
      render: (profile) => profile.firstName,
    },
    {
      key: 'lastName',
      header: 'Last Name',
      render: (profile) => profile.lastName,
    },
    {
      key: 'age',
      header: 'Age',
      render: (profile) => calculateAge(profile.dateOfBirth),
      width: '80px',
    },
    {
      key: 'school',
      header: 'School',
      render: (profile) => profile.schoolName ?? '—',
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (profile) => profile.gradeLevel ?? '—',
      width: '100px',
    },
    {
      key: 'active',
      header: 'Status',
      render: (profile) => (
        <span className={`status-badge ${profile.active ? 'status-active' : 'status-inactive'}`}>
          {profile.active ? 'Active' : 'Inactive'}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: '',
      className: 'col-actions',
      width: '32px',
      render: (profile) => canWrite ? (
        <ActionsMenu
          items={[
            { label: 'Edit', onClick: () => setModalTarget(profile) },
            ...(profile.active ? [{ label: 'Deactivate', onClick: () => setConfirmAction({ type: 'deactivate', profile }), variant: 'danger' as const }] : []),
            ...(!profile.active ? [{ label: 'Reactivate', onClick: () => setConfirmAction({ type: 'reactivate', profile }) }] : []),
          ]}
        />
      ) : null,
    },
  ], [canWrite]);

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Youth</h1>
            {canWrite && (
              <Button onClick={() => setModalTarget('new')}>
                + Sign Up
              </Button>
            )}
          </div>
        </div>

        <Table
          columns={youthColumns}
          data={youth}
          loading={loading}
          error={error}
          emptyMessage="No youth profiles found"
          keyExtractor={(profile) => profile.id}
          maxHeight="calc(100vh - 200px)"
        />
      </div>

      <YouthModal
        isOpen={modalTarget !== null}
        youthData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        onClose={() => setModalTarget(null)}
        onSuccess={(savedYouth) => {
          const isEdit = modalTarget !== 'new' && modalTarget !== null;
          setModalTarget(null);
          setYouth(prev =>
            isEdit
              ? prev.map(y => y.id === savedYouth.id ? savedYouth : y)
              : [...prev, savedYouth]
          );
        }}
      />

      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'deactivate' ? 'Deactivate Profile' : 'Reactivate Profile'}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        disableClose={confirmModal.disableClose}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmLabel(confirmAction)}</p>}
      </Modal>
    </>
  );
}
