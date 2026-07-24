import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import { useAuth } from '../../../common/context/AuthContext';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import { formatShortDate } from '../../../common/utils/date';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import TableDetailLayout from '../../../common/components/TableDetailLayout/TableDetailLayout';
import { NotesCard, PrimaryContactCard } from '../../../common/components/DetailCards/DetailCards';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import { usePrograms } from '../../../common/hooks/usePrograms';
import { convertExpressionOfInterest, updateExpressionOfInterestStatus } from './api/expressionsOfInterest.api';
import { useExpressionsOfInterest } from './hooks/useExpressionsOfInterest';
import type { ExpressionOfInterest, ExpressionOfInterestFilters } from './types';
import './ExpressionsOfInterest.css';

const submissionYouthName = (submission: ExpressionOfInterest) =>
  [submission.youthFirstName, submission.youthLastName].filter(Boolean).join(' ');

export default function ExpressionsOfInterest() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<ExpressionOfInterest['status'][]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const queryFilters = useMemo<ExpressionOfInterestFilters>(() => ({ search: debouncedSearch, statuses: statusFilters, programIds: programFilters }), [debouncedSearch, statusFilters, programFilters]);
  const { submissions, setSubmissions, loading, error } = useExpressionsOfInterest(queryFilters);
  const { programs } = usePrograms();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');
  const [selectedSubmission, setSelectedSubmission] = useState<ExpressionOfInterest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setSelectedSubmission(current => current
      ? submissions.find(item => item.id === current.id) ?? null
      : null);
  }, [submissions]);

  const statuses: ExpressionOfInterest['status'][] = ['new', 'reviewed', 'contacted', 'converted', 'signed_up', 'lost', 'spam'];
  const label = (value: string) => value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'status', label: 'Status', options: statuses.map(status => ({ value: status, label: label(status) })) },
    { id: 'program', label: 'Program', options: programs.map(program => ({ value: program.id, label: program.name })) },
  ], [programs]);

  const handleStatusUpdate = async (item: ExpressionOfInterest, status: ExpressionOfInterest['status']) => {
    const updated = await updateExpressionOfInterestStatus(item.id, status);
    setSelectedSubmission(current => current?.id === updated.id ? { ...current, ...updated } : current);
    setSubmissions(current => current.map(entry => entry.id === updated.id ? { ...entry, ...updated } : entry));
  };

  const handleConvert = async (item: ExpressionOfInterest) => {
    setActionError(null);
    setConvertingId(item.id);
    try {
      await convertExpressionOfInterest(item.id);
      navigate('/outreach/leads');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to convert this submission'));
      setConvertingId(null);
    }
  };

  const statusBadge = (status: ExpressionOfInterest['status']) => {
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

  const columns: TableColumn<ExpressionOfInterest>[] = [
    { key: 'youthName', header: 'Youth Name', render: submissionYouthName },
    { key: 'age', header: 'Age', width: '70px', render: item => item.age },
    { key: 'program', header: 'Program', render: item => item.suggestedProgramName ?? '—' },
    { key: 'submittedAt', header: 'Date', width: '130px', render: item => formatShortDate(item.createdAt) },
    { key: 'status', header: 'Status', width: '120px', render: item => statusBadge(item.status) },
    ...(canWrite ? [{
      key: 'actions' as const,
      header: '',
      className: 'col-actions',
      width: '32px',
      render: (item: ExpressionOfInterest) => item.status === 'converted' ? null : (
        <ActionsMenu
          ariaLabel={`More actions for ${submissionYouthName(item)}`}
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
      <PageHeader
        title="Outreach"
        search={<SearchInput label="Search expressions of interest" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth, school, or program" />}
        filters={<FilterCard
          categories={filterCategories}
          values={{ status: statusFilters, program: programFilters }}
          onApply={(category, selected) => {
            if (category === 'status') setStatusFilters(selected as ExpressionOfInterest['status'][]);
            if (category === 'program') setProgramFilters(selected);
          }}
          onClearAll={() => { setStatusFilters([]); setProgramFilters([]); }}
        />}
      />
      <div className="outreach-tab-content data-detail-page-content">
        {(error || actionError) && <p className="page-error">{error || actionError}</p>}

        <TableDetailLayout
          ariaLabel="Expressions of interest"
          table={<Table columns={columns} data={submissions} loading={loading} emptyMessage={search || statusFilters.length || programFilters.length ? 'No expressions of interest match these filters' : 'No expressions of interest yet.'} keyExtractor={item => item.id} maxHeight="calc(100vh - 220px)" selectedKey={selectedSubmission?.id} onRowSelect={setSelectedSubmission} />}
          details={<>
            <PrimaryContactCard contact={selectedSubmission ? {
              firstName: selectedSubmission.contactFirstName,
              lastName: selectedSubmission.contactLastName,
              phoneNumber: selectedSubmission.contactPhoneNumber,
              relationship: selectedSubmission.contactRelationship,
            } : null} />
            <NotesCard notes={selectedSubmission?.notes} selected={selectedSubmission !== null} />
          </>}
        />
      </div>
    </>
  );
}
