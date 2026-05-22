import { useState, useMemo } from 'react';
import Header from '../../common/components/Header/Header';
import Button from '../../common/components/Button/Button';
import Modal from '../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../common/components/Table/Table';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import { useSchools } from './hooks/useSchools';
import { useAuth } from '../../common/context/AuthContext';
import SchoolModal from './components/SchoolModal/SchoolModal';
import { useConfirmModal } from '../../common/hooks/useConfirmModal';
import { deleteSchool } from './api/schools.api';
import type { School } from './types';
import './Schools.css';

export default function Schools() {
  const { schools, setSchools, loading, error } = useSchools();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:schools');

  const [modalTarget, setModalTarget] = useState<School | 'new' | null>(null);
  const [confirmSchool, setConfirmSchool] = useState<School | null>(null);

  const handleDelete = async () => {
    if (!confirmSchool) return;
    await deleteSchool(confirmSchool.id);
    setSchools(prev => prev.filter(s => s.id !== confirmSchool.id));
  };

  const confirmModal = useConfirmModal({
    isOpen: !!confirmSchool,
    onConfirm: handleDelete,
    onClose: () => setConfirmSchool(null),
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'School deleted',
  });

  const boardLabel = (board: string | null) => {
    if (board === 'catholic') return 'Catholic';
    if (board === 'public') return 'Public';
    return '—';
  };

  const columns = useMemo<TableColumn<School>[]>(() => [
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
            { label: 'Edit', onClick: () => setModalTarget(s) },
            { label: 'Delete', onClick: () => setConfirmSchool(s), variant: 'danger' as const },
          ]}
        />
      ),
    }] : []),
  ], [canWrite]);

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Schools</h1>
            {canWrite && (
              <Button onClick={() => setModalTarget('new')}>
                + Add School
              </Button>
            )}
          </div>
        </div>

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
          onSuccess={(school) => {
            setModalTarget(null);
            setSchools(prev => {
              const exists = prev.some(s => s.id === school.id);
              return exists ? prev.map(s => s.id === school.id ? school : s) : [...prev, school];
            });
          }}
          schoolData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        />

        <Modal
          isOpen={!!confirmSchool}
          onClose={() => setConfirmSchool(null)}
          title="Delete School"
          status={confirmModal.status}
          statusMessage={confirmModal.statusMessage}
          footer={confirmModal.footer}
          disableClose={confirmModal.disableClose}
          successDelay={confirmModal.successDelay}
        >
          <p>Delete <strong>{confirmSchool?.name}</strong>? Any youth linked to this school will have their school cleared.</p>
        </Modal>
      </div>
    </>
  );
}
