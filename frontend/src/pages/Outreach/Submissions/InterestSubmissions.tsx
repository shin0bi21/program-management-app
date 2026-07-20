import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import Modal from '../../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import { useAuth } from '../../../common/context/AuthContext';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import { formatShortDate } from '../../../common/utils/date';
import { convertCohortInterestSubmission, updateCohortInterestStatus } from './api/cohortInterest.api';
import { useCohortInterest } from './hooks/useCohortInterest';
import type { CohortInterestSubmission } from './types';
import './InterestSubmissions.css';

const submissionYouthName = (submission: CohortInterestSubmission) =>
  [submission.youthFirstName, submission.youthLastName].filter(Boolean).join(' ');

const primaryContactName = (submission: CohortInterestSubmission) =>
  [submission.contactFirstName, submission.contactLastName].filter(Boolean).join(' ') || '—';

const relationshipLabels: Record<NonNullable<CohortInterestSubmission['contactRelationship']>, string> = {
  parent: 'Parent',
  sibling: 'Sibling',
  guardian: 'Guardian',
  emergency: 'Emergency contact',
};

export default function InterestSubmissions() {
  const { submissions, loading, error } = useCohortInterest();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');
  const [rows, setRows] = useState<CohortInterestSubmission[]>([]);
  const [selectedContactSubmission, setSelectedContactSubmission] = useState<CohortInterestSubmission | null>(null);
  const [selectedNoteSubmission, setSelectedNoteSubmission] = useState<CohortInterestSubmission | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const data = rows.length ? rows : submissions;

  const handleStatusUpdate = async (item: CohortInterestSubmission, status: CohortInterestSubmission['status']) => {
    const updated = await updateCohortInterestStatus(item.id, status);
    setSelectedContactSubmission((current) => (current?.id === updated.id ? updated : current));
    setSelectedNoteSubmission((current) => (current?.id === updated.id ? updated : current));
    setRows((current) => {
      const source = current.length ? current : submissions;
      return source.map((entry) => (entry.id === updated.id ? updated : entry));
    });
  };

  const handleConvert = async (item: CohortInterestSubmission) => {
    setActionError(null);
    setConvertingId(item.id);
    try {
      await convertCohortInterestSubmission(item.id);
      navigate('/outreach/leads');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to convert this submission'));
      setConvertingId(null);
    }
  };

  const statusBadge = (status: CohortInterestSubmission['status']) => {
    const className =
      status === 'new'
        ? 'status-badge status-new'
        : status === 'reviewed'
          ? 'status-badge status-reviewed'
        : status === 'converted'
          ? 'status-badge status-signed-up'
        : status === 'spam'
          ? 'status-badge status-lost'
        : status === 'contacted'
          ? 'status-badge status-contacted'
          : status === 'signed_up'
            ? 'status-badge status-signed-up'
            : 'status-badge status-lost';

    const label =
      status === 'new'
        ? 'New'
        : status === 'reviewed'
          ? 'Reviewed'
        : status === 'converted'
          ? 'Converted'
        : status === 'spam'
          ? 'Spam'
        : status === 'contacted'
          ? 'Contacted'
          : status === 'signed_up'
            ? 'Signed Up'
            : 'Lost';
    return <span className={className}>{label}</span>;
  };

  const columns: TableColumn<CohortInterestSubmission>[] = [
    { key: 'youthName', header: 'Youth Name', render: submissionYouthName },
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
      key: 'contactDetails',
      header: 'Primary Contact',
      width: '150px',
      render: item => (
        <Button variant="secondary" size="sm" onClick={() => setSelectedContactSubmission(item)}>
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
      render: (item: CohortInterestSubmission) => item.status === 'converted' ? null : (
        <ActionsMenu
          items={[
            { id: 'convert', label: 'Convert to Lead', onClick: () => void handleConvert(item) },
            { id: 'reviewed', label: 'Mark Reviewed', onClick: () => void handleStatusUpdate(item, 'reviewed') },
            { id: 'spam', label: 'Mark Spam', variant: 'danger' as const, onClick: () => void handleStatusUpdate(item, 'spam') },
          ]}
          disabled={convertingId === item.id}
        />
      ),
    }] : []),
  ];

  return (
    <>
      <div className="outreach-tab-content">
        {(error || actionError) && <p className="page-error">{error || actionError}</p>}

        <Table
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="No interest submissions yet."
          keyExtractor={(item) => item.id}
          maxHeight="calc(100vh - 220px)"
        />
      </div>

      <Modal
        isOpen={selectedContactSubmission !== null}
        onClose={() => setSelectedContactSubmission(null)}
        title={selectedContactSubmission ? `${submissionYouthName(selectedContactSubmission)} Primary Contact` : 'Primary contact'}
        maxWidth="560px"
      >
        {selectedContactSubmission && (
          <div className="cohort-interest-details">
            <div className="cohort-interest-detail-row">
              <span className="cohort-interest-detail-label">Contact name</span>
              <span>{primaryContactName(selectedContactSubmission)}</span>
            </div>
            <div className="cohort-interest-detail-row">
              <span className="cohort-interest-detail-label">Relationship</span>
              <span>{selectedContactSubmission.contactRelationship
                ? relationshipLabels[selectedContactSubmission.contactRelationship]
                : '—'}</span>
            </div>
            <div className="cohort-interest-detail-row">
              <span className="cohort-interest-detail-label">Contact phone</span>
              <span>{selectedContactSubmission.contactPhoneNumber ?? '—'}</span>
            </div>
            <div className="cohort-interest-detail-row cohort-interest-response-start">
              <span className="cohort-interest-detail-label">Response email</span>
              <span>{selectedContactSubmission.email ?? '—'}</span>
            </div>
            <div className="cohort-interest-detail-row">
              <span className="cohort-interest-detail-label">Response phone</span>
              <span>{selectedContactSubmission.phoneNumber ?? '—'}</span>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={selectedNoteSubmission !== null}
        onClose={() => setSelectedNoteSubmission(null)}
        title={selectedNoteSubmission ? `${submissionYouthName(selectedNoteSubmission)} Note` : 'Note'}
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
