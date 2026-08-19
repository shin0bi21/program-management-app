import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/authContext';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import PageBody from '../../../common/components/PageBody/PageBody';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { formatShortDate } from '../../../common/utils/date';
import { getErrorMessage } from '../../../http/clientErrors';
import { convertExpressionOfInterest, updateExpressionOfInterestStatus } from './expressionsOfInterest.api';
import ExpressionOfInterestDashboard from './components/ExpressionOfInterestDashboard/ExpressionOfInterestDashboard';
import { useExpressionOfInterestControls } from './hooks/useExpressionOfInterestControls';
import { useExpressionsOfInterest } from './hooks/useExpressionsOfInterest';
import type { ExpressionOfInterest } from './types';
import './ExpressionsOfInterest.css';

const EXPRESSION_INTEREST_COLUMN_KEYS = [
  'firstName',
  'lastName',
  'age',
  'school',
  'program',
  'submittedByRole',
  'submittedAt',
  'status',
] as const;
const EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY = ['expressions-of-interest', 'list'] as const;
const LEADS_LIST_QUERY_KEY = ['leads', 'list'] as const;

export default function ExpressionsOfInterest() {
  // Services and permissions.
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');

  // Controls and remote records.
  const { programs, loading: programsLoading, error: programsError } = usePrograms();
  const controls = useExpressionOfInterestControls(
    programs,
    programsLoading,
    programsError,
    EXPRESSION_INTEREST_COLUMN_KEYS,
  );
  const {
    search, setSearch, queryFilters, statusFilters, programFilters, sorting,
    columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    hasActiveQueryFilters,
  } = controls;
  const { submissions, loading, refreshing, error, hasNextPage, loadingNextPage, loadNextPage } = useExpressionsOfInterest(
    EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY,
    queryFilters,
    sorting,
  );

  // Selection and mutation state.
  const {
    selectedItem: selectedSubmission,
    selectedKey: selectedSubmissionId,
    selectItem: selectSubmission,
  } = useTableSelection(submissions);
  const [actionError, setActionError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Mutations and cache reconciliation.
  const handleStatusUpdate = async (item: ExpressionOfInterest, status: ExpressionOfInterest['status']) => {
    await updateExpressionOfInterestStatus(item.id, status);
    await queryClient.invalidateQueries({ queryKey: EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY });
  };

  const handleConvert = async (item: ExpressionOfInterest) => {
    setActionError(null);
    setConvertingId(item.id);
    try {
      await convertExpressionOfInterest(item.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: LEADS_LIST_QUERY_KEY }),
      ]);
      setConvertingId(null);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to convert this submission'));
      await queryClient.invalidateQueries({ queryKey: EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY });
      setConvertingId(null);
    }
  };

  // Table presentation.
  const columns: TableColumn<ExpressionOfInterest>[] = [
    { key: 'firstName', sortKey: 'name', header: 'First Name', render: item => item.youthFirstName },
    { key: 'lastName', header: 'Last Name', render: item => item.youthLastName },
    { key: 'age', sortKey: 'age', header: 'Age', width: 100, render: item => item.age },
    { key: 'school', sortKey: 'school', header: 'School', render: item => item.school },
    { key: 'program', sortKey: 'program', header: 'Program', render: item => item.suggestedProgramName ?? '—' },
    { key: 'submittedByRole', sortKey: 'submittedByRole', header: 'Filled Out By', width: 130, render: item => submitterRoleLabel(item.submittedByRole) },
    { key: 'submittedAt', sortKey: 'createdAt', header: 'Date', width: 130, render: item => formatShortDate(item.createdAt) },
    { key: 'status', sortKey: 'status', header: 'Status', width: 120, render: item => statusBadge(item.status) },
    ...(canWrite ? [{
      key: 'actions' as const,
      width: 40,
      resizable: false,
      header: '',
      className: 'col-actions',
      render: (item: ExpressionOfInterest) => (
        item.status === 'converted' || item.status === 'signed_up'
      ) ? null : (
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
    <main className="page-container page-container--data">
      <PageHeader
        title="Outreach"
        search={<SearchInput label="Search expressions of interest" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth, school, or program" />}
        columns={<ColumnVisibilityMenu columns={columns} hiddenColumnKeys={hiddenColumns} onHiddenColumnKeysChange={controls.setHiddenColumns} />}
        filters={<FilterCard
          categories={filterCategories}
          values={{ status: statusFilters, program: programFilters }}
          onApply={controls.applyFilter}
          onClearAll={controls.clearFilters}
        />}
      />
      {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
      {programsError && <p className="form-error" role="alert">{programsError}</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <PageBody
        ariaLabel="Expressions of interest"
        table={<Table
          ariaLabel="Expressions of interest"
          columns={columns}
          hiddenColumnKeys={hiddenColumns}
          data={submissions}
          loading={loading}
          refreshing={refreshing}
          error={error ?? undefined}
          emptyMessage={hasActiveQueryFilters
            ? 'No expressions of interest match these filters'
            : 'No expressions of interest yet'}
          keyExtractor={item => item.id}
          selectedKey={selectedSubmissionId}
          onRowSelect={selectSubmission}
          sorting={sorting}
          onSortingChange={controls.setSorting}
          columnWidths={columnWidths}
          onColumnWidthsChange={controls.setColumnWidths}
          hasNextPage={hasNextPage}
          loadingNextPage={loadingNextPage}
          onLoadNextPage={loadNextPage}
        />}
        dashboard={<ExpressionOfInterestDashboard submission={selectedSubmission} />}
      />
    </main>
  );
}

function submissionYouthName(submission: ExpressionOfInterest) {
  return [submission.youthFirstName, submission.youthLastName].filter(Boolean).join(' ');
}

function submitterRoleLabel(role: ExpressionOfInterest['submittedByRole']) {
  return role ? role[0].toUpperCase() + role.slice(1) : 'Not recorded';
}

function statusBadge(status: ExpressionOfInterest['status']) {
  const className = status === 'new'
    ? 'status-badge status-new'
    : status === 'reviewed'
      ? 'status-badge status-reviewed'
      : status === 'converted' || status === 'signed_up'
        ? 'status-badge status-signed-up'
        : status === 'spam'
          ? 'status-badge status-lost'
          : status === 'contacted'
            ? 'status-badge status-contacted'
            : 'status-badge status-lost';
  const label = status.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
  return <span className={className}>{label}</span>;
}
