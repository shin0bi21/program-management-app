import { useState } from 'react';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import Header from '../../../common/components/Header/Header';
import Modal from '../../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import { useAuth } from '../../../common/context/AuthContext';
import { formatShortDate } from '../../../common/utils/date';
import { updateCohortInterestStatus } from './api/cohortInterest.api';
import { useCohortInterest } from './hooks/useCohortInterest';
import type { CohortInterestSubmission } from './types';
import './CohortInterest.css';

export default function CohortInterest() {
  const { submissions, loading, error } = useCohortInterest();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:settings');
  const [rows, setRows] = useState<CohortInterestSubmission[]>([]);
  const [selectedParentSubmission, setSelectedParentSubmission] = useState<CohortInterestSubmission | null>(null);
  const [selectedNoteSubmission, setSelectedNoteSubmission] = useState<CohortInterestSubmission | null>(null);

  const data = rows.length ? rows : submissions;

  const handleStatusUpdate = async (item: CohortInterestSubmission, status: CohortInterestSubmission['status']) => {
    const updated = await updateCohortInterestStatus(item.id, status);
    setSelectedParentSubmission((current) => (current?.id === updated.id ? updated : current));
    setSelectedNoteSubmission((current) => (current?.id === updated.id ? updated : current));
    setRows((current) => {
      const source = current.length ? current : submissions;
      return source.map((entry) => (entry.id === updated.id ? updated : entry));
    });
  };

  const statusBadge = (status: CohortInterestSubmission['status']) => {
    const className =
      status === 'new'
        ? 'status-badge status-new'
        : status === 'contacted'
          ? 'status-badge status-contacted'
          : status === 'signed_up'
            ? 'status-badge status-signed-up'
            : 'status-badge status-lost';

    const label =
      status === 'new'
        ? 'New'
        : status === 'contacted'
          ? 'Contacted'
          : status === 'signed_up'
            ? 'Signed Up'
            : 'Lost';
    return <span className={className}>{label}</span>;
  };

  const columns: TableColumn<CohortInterestSubmission>[] = [
    { key: 'youthName', header: 'Youth Name', render: item => item.youthName },
    { key: 'age', header: 'Age', width: '70px', render: item => item.age },
    { key: 'submittedAt', header: 'Date', width: '130px', render: item => formatShortDate(item.createdAt) },
    {
      key: 'note',
      header: 'Note',
      width: '100px',
      render: item => (
        <Button variant="secondary" size="sm" onClick={() => setSelectedNoteSubmission(item)}>
          View
        </Button>
      ),
    },
    {
      key: 'parentDetails',
      header: 'Parent Details',
      width: '140px',
      render: item => (
        <Button variant="secondary" size="sm" onClick={() => setSelectedParentSubmission(item)}>
          View
        </Button>
      ),
    },
    { key: 'status', header: 'Status', width: '120px', render: item => statusBadge(item.status) },
    ...(canWrite ? [{
      key: 'actions' as const,
      header: '',
      className: 'col-actions',
      width: '32px',
      render: (item: CohortInterestSubmission) => (
        <ActionsMenu
          items={[
            { id: 'contacted', label: 'Contacted', onClick: () => void handleStatusUpdate(item, 'contacted') },
            { id: 'signed_up', label: 'Signed Up', onClick: () => void handleStatusUpdate(item, 'signed_up') },
            { id: 'lost', label: 'Lost', onClick: () => void handleStatusUpdate(item, 'lost') },
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
            <h1 className="page-title">Cohort Interest</h1>
          </div>
        </div>

        {error && <p className="page-error">{error}</p>}

        <Table
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="No cohort signups yet."
          keyExtractor={(item) => item.id}
          maxHeight="calc(100vh - 220px)"
        />
      </div>

      <Modal
        isOpen={selectedParentSubmission !== null}
        onClose={() => setSelectedParentSubmission(null)}
        title={selectedParentSubmission ? `${selectedParentSubmission.youthName} Parent Details` : 'Parent details'}
        maxWidth="560px"
      >
        {selectedParentSubmission && (
          <div className="cohort-interest-details">
            <div className="cohort-interest-detail-row">
              <span className="cohort-interest-detail-label">Parent name</span>
              <span>{selectedParentSubmission.parentName ?? '—'}</span>
            </div>
            <div className="cohort-interest-detail-row">
              <span className="cohort-interest-detail-label">Phone</span>
              <span>{selectedParentSubmission.phoneNumber ?? '—'}</span>
            </div>
            <div className="cohort-interest-detail-row">
              <span className="cohort-interest-detail-label">Email</span>
              <span>{selectedParentSubmission.email ?? '—'}</span>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={selectedNoteSubmission !== null}
        onClose={() => setSelectedNoteSubmission(null)}
        title={selectedNoteSubmission ? `${selectedNoteSubmission.youthName} Note` : 'Note'}
        maxWidth="560px"
      >
        {selectedNoteSubmission && (
          <div className="cohort-interest-details">
            <div className="cohort-interest-detail-block">
              <span className="cohort-interest-detail-label">Note</span>
              <p>{selectedNoteSubmission.message?.trim() || 'No note'}</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
