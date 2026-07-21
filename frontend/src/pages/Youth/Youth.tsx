import { useState, useMemo } from 'react';
import Button from '../../common/components/Button/Button';
import Header from '../../common/components/Header/Header';
import Modal from '../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../common/components/Table/Table';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import { useYouth, YouthProfile } from './hooks/useYouth';
import YouthModal from './components/YouthModal/YouthModal';
import { useAuth } from '../../common/context/AuthContext';
import { useConfirmModal, ConfirmAction } from '../../common/hooks/useConfirmModal';
import { toggleYouthStatus } from '../../common/api/youth.api';
import { calculateAge } from '../../common/utils/time';
import './Youth.css';

export default function Youth() {
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const { youth, setYouth, loading, error } = useYouth();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

  const handleEditProfile = (profile: YouthProfile) => setModalTarget(profile);

  const handleDeactivateProfile = (profile: YouthProfile) => setConfirmAction({
    title: 'Deactivate Profile',
    message: `Mark ${profile.firstName} ${profile.lastName} as inactive in the youth program? Their login account will not be affected.`,
    confirmLabel: 'Deactivate',
    confirmVariant: 'danger',
    successMessage: 'Profile deactivated',
    onConfirm: async () => {
      const updated = await toggleYouthStatus(profile.id);
      setYouth(prev => prev.map(y => y.id === updated.id ? updated : y));
    },
  });

  const handleReactivateProfile = (profile: YouthProfile) => setConfirmAction({
    title: 'Activate Profile',
    message: `Mark ${profile.firstName} ${profile.lastName} as active in the youth program? Their login account will not be affected.`,
    confirmLabel: 'Activate',
    confirmVariant: 'primary',
    successMessage: 'Profile activated',
    onConfirm: async () => {
      const updated = await toggleYouthStatus(profile.id);
      setYouth(prev => prev.map(y => y.id === updated.id ? updated : y));
    },
  });

  const handleSaveYouth = (savedYouth: YouthProfile) => {
    setModalTarget(null);
    setYouth(prev => {
      const exists = prev.some(y => y.id === savedYouth.id);
      return exists ? prev.map(y => y.id === savedYouth.id ? savedYouth : y) : [...prev, savedYouth];
    });
  };

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
      key: 'status',
      header: 'Status',
      render: (profile) => (
        <span className={`status-badge status-${profile.status}`}>
          {profile.status === 'active' ? 'Active' : 'Inactive'}
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
            { id: 'edit',        label: 'Edit',       onClick: () => handleEditProfile(profile) },
            ...(profile.status === 'active' ? [{ id: 'deactivate', label: 'Deactivate', variant: 'danger' as const, onClick: () => handleDeactivateProfile(profile) }] : []),
            ...(profile.status === 'inactive' ? [{ id: 'reactivate', label: 'Activate', onClick: () => handleReactivateProfile(profile) }] : []),
          ]}
        />
      ) : null,
    },
  ], [canWrite]);

  return (
    <>
      <Header />
      <div className="page-container">
        <PageHeader
          title="Youth"
          actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add Youth</Button> : undefined}
        />

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
        onSuccess={handleSaveYouth}
      />

      <Modal
        isOpen={!!confirmAction}
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
