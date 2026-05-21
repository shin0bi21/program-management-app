import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import Button from '../../common/components/Button/Button';
import Modal from '../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../common/components/Table/Table';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import { useSchools } from './hooks/useSchools';
import { useAuth } from '../../common/context/AuthContext';
import SchoolModal from './components/SchoolModal/SchoolModal';
import { deleteSchool } from './api/schools.api';
import { getErrorMessage } from '../../common/utils/clientErrors';
import type { School } from './types';
import './Schools.css';

export default function Schools() {
  const { schools, setSchools, loading, error } = useSchools();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:schools');

  const [modalOpen, setModalOpen] = useState(false);
  const [schoolToEdit, setSchoolToEdit] = useState<School | undefined>(undefined);
  const [confirmSchool, setConfirmSchool] = useState<School | null>(null);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState('');
  const [confirming, setConfirming] = useState(false);

  const closeConfirm = () => { setConfirmSchool(null); setConfirmError(''); setConfirmSuccess(''); };

  const handleModalClose = () => { setModalOpen(false); setSchoolToEdit(undefined); };

  const handleDelete = async () => {
    if (!confirmSchool) return;
    setConfirming(true);
    setConfirmError('');
    try {
      await deleteSchool(confirmSchool.id);
      setSchools(prev => prev.filter(s => s.id !== confirmSchool.id));
      setConfirmSuccess('School deleted');
      setTimeout(closeConfirm, 1200);
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'Failed to delete school'));
    } finally {
      setConfirming(false);
    }
  };

  const boardLabel = (board: string | null) => {
    if (board === 'catholic') return 'Catholic';
    if (board === 'public') return 'Public';
    return '—';
  };

  const columns: TableColumn<School>[] = [
    { key: 'name', header: 'School Name', render: s => s.name },
    { key: 'board', header: 'Board', render: s => boardLabel(s.board), width: '120px' },
    { key: 'address', header: 'Address', render: s => s.address ?? '—' },
    { key: 'postalCode', header: 'Postal Code', render: s => s.postalCode ?? '—', width: '130px' },
    ...(canWrite ? [{
      key: 'actions' as const,
      header: '',
      width: '100px',
      render: (s: School) => (
        <ActionsMenu
          disabled={confirming}
          items={[
            { label: 'Edit', onClick: () => { setSchoolToEdit(s); setModalOpen(true); } },
            { label: 'Delete', onClick: () => setConfirmSchool(s), variant: 'danger' as const },
          ]}
        />
      ),
    }] : []),
  ];

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Schools</h1>
            {canWrite && (
              <Button onClick={() => { setSchoolToEdit(undefined); setModalOpen(true); }}>
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
          isOpen={modalOpen}
          onClose={handleModalClose}
          onSuccess={(school) => {
            setModalOpen(false);
            setSchoolToEdit(undefined);
            setSchools(prev => {
              const exists = prev.some(s => s.id === school.id);
              return exists ? prev.map(s => s.id === school.id ? school : s) : [...prev, school];
            });
          }}
          schoolData={schoolToEdit}
        />

        <Modal
          isOpen={!!confirmSchool}
          onClose={closeConfirm}
          title="Delete School"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closeConfirm} disabled={confirming}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete} disabled={confirming || !!confirmSuccess}>
                {confirming ? 'Deleting...' : 'Delete'}
              </Button>
            </>
          }
          status={confirmSuccess ? 'success' : confirmError ? 'error' : 'idle'}
          statusMessage={confirmSuccess || confirmError || undefined}
        >
          <p>Delete <strong>{confirmSchool?.name}</strong>? Any youth linked to this school will have their school cleared.</p>
        </Modal>
      </div>
    </>
  );
}
