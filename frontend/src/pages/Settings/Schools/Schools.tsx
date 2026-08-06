import { useMemo, useState } from 'react';
import Header from '../../../common/components/Header/Header';
import Button from '../../../common/components/Button/Button';
import Modal from '../../../common/components/Modal/Modal';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import { useAuth } from '../../../common/context/AuthContext';
import { useSchools } from '../../../common/hooks/useSchools';
import { useConfirmModal, type ConfirmAction } from '../../../common/hooks/useConfirmModal';
import { deleteSchool } from '../../../common/api/schools.api';
import type { School } from '../../../common/types/school';
import SchoolModal from './SchoolModal';
import './Schools.css';

const boardLabel = (board: string | null) => board ? `${board[0].toUpperCase()}${board.slice(1)}` : '—';

export default function Schools() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:schools');
  const { schools, upsertSchool, removeSchool, loading, error } = useSchools();
  const [search, setSearch] = useState('');
  const [modalTarget, setModalTarget] = useState<School | 'new' | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  const filteredSchools = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return schools;
    return schools.filter(school => [school.name, school.board, school.address, school.postalCode]
      .some(value => value?.toLowerCase().includes(query)));
  }, [schools, search]);

  const requestDelete = (school: School) => setConfirmAction({
    title: 'Delete School',
    message: <>Delete {school.name}? Schools assigned to youth profiles cannot be deleted.</>,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'School deleted',
    onConfirm: async () => {
      await deleteSchool(school.id);
      removeSchool(school.id);
    },
  });

  const columns = useMemo<TableColumn<School>[]>(() => {
    const base: TableColumn<School>[] = [
      { key: 'name', header: 'School', render: school => school.name },
      { key: 'board', header: 'Board', render: school => boardLabel(school.board) },
      { key: 'address', header: 'Address', render: school => school.address || '—' },
      { key: 'postalCode', header: 'Postal Code', width: '130px', render: school => school.postalCode || '—' },
    ];
    return canWrite ? [...base, {
      key: 'actions', header: '', className: 'col-actions', render: school => (
        <ActionsMenu ariaLabel={`More actions for ${school.name}`} items={[
          { id: 'edit', label: 'Edit', onClick: () => setModalTarget(school) },
          { id: 'delete', label: 'Delete', variant: 'danger', onClick: () => requestDelete(school) },
        ]} />
      ),
    }] : base;
  }, [canWrite]);

  return (
    <>
      <Header />
      <main className="page-container schools-page">
        <PageHeader
          title="Schools"
          actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
          search={<SearchInput label="Search schools" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search schools" />}
        />
        <section className="schools-panel" aria-label="Schools list">
          <Table ariaLabel="Schools" columns={columns} data={filteredSchools} loading={loading} error={error} emptyMessage={search ? 'No schools match this search' : 'No schools found'} keyExtractor={school => school.id} />
        </section>
      </main>
      {modalTarget && (
        <SchoolModal school={modalTarget === 'new' ? undefined : modalTarget} onClose={() => setModalTarget(null)} onSuccess={school => { upsertSchool(school); setModalTarget(null); }} />
      )}
      <Modal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} title={confirmAction?.title ?? ''} status={confirmModal.status} statusMessage={confirmModal.statusMessage} footer={confirmModal.footer} disableClose={confirmModal.disableClose} successDelay={confirmModal.successDelay}>
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
    </>
  );
}
