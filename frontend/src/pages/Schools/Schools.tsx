import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import Button from '../../common/components/Button/Button';
import Modal from '../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../common/components/Table/Table';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import type { School } from './types';
import { useSchools } from './hooks/useSchools';
import { useAuth } from '../../common/context/AuthContext';
import SchoolModal from './components/SchoolModal/SchoolModal';
import { useConfirmModal, ConfirmAction } from '../../common/hooks/useConfirmModal';
import { deleteSchool } from './api/schools.api';
import './Schools.css';

const BOARD_LABELS: Record<string, string> = {
  catholic: 'Catholic',
  public:   'Public',
};

function boardLabel(board: string | null): string {
  return board ? (BOARD_LABELS[board] ?? '—') : '—';
}

export default function Schools() {
  // 1. Hooks / derived state
  const { schools, setSchools, loading, error } = useSchools();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:schools');

  const [modalTarget, setModalTarget] = useState<School | 'new' | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // 2. Modal / controller helpers
  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

  // 3. Event handlers
  const handleEditSchool = (school: School) => {
    setModalTarget(school);
  };

  const handleDeleteSchool = (school: School) => {
    setConfirmAction({
      title: 'Delete School',
      message: <>Delete <strong>{school.name}</strong>? Any youth linked to this school will have their school cleared.</>,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      successMessage: 'School deleted',
      onConfirm: async () => {
        await deleteSchool(school.id);
        setSchools(prev => prev.filter(s => s.id !== school.id));
      },
    });
  };

  const handleSaveSchool = (school: School) => {
    setModalTarget(null);
    setSchools(prev => {
      const exists = prev.some(s => s.id === school.id);
      return exists ? prev.map(s => s.id === school.id ? school : s) : [...prev, school];
    });
  };

  // 4. Render helpers / table config
  const columns: TableColumn<School>[] = [
    { key: 'name', header: 'School Name', render: s => s.name },
    { key: 'board', header: 'Board', render: s => boardLabel(s.board), width: '120px' },
    { key: 'address', header: 'Address', render: s => s.address ?? '—' },
    { key: 'postalCode', header: 'Postal Code', render: s => s.postalCode ?? '—', width: '130px' },
    ...(canWrite ? [{
      key: 'actions' as const,
      header: '',
      className: 'col-actions',
      width: '32px',
      render: (s: School) => (
        <ActionsMenu
          items={[
            { id: 'edit',   label: 'Edit',   onClick: () => handleEditSchool(s) },
            { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => handleDeleteSchool(s) },
          ]}
        />
      ),
    }] : []),
  ];

  // 5. JSX
  return (
    <>
      <Header />
      <div className="page-container">
        <PageHeader
          title="Schools"
          actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add School</Button> : undefined}
        />

        {error && <p className="page-error">{error}</p>}

        <Table
          columns={columns}
          data={schools}
          keyExtractor={(s) => s.id}
          loading={loading}
          emptyMessage="No schools found."
        />

        <SchoolModal
          isOpen={modalTarget !== null}
          onClose={() => setModalTarget(null)}
          onSuccess={handleSaveSchool}
          schoolData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
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
      </div>
    </>
  );
}
