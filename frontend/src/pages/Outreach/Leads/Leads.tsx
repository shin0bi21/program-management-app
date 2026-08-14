import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/authContext';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import { COHORT_QUERY_KEY } from '../../../common/features/programming/queryKeys';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { YOUTH_QUERY_KEY } from '../../../common/features/youth/queryKeys';
import { formatShortDate } from '../../../common/utils/date';
import { EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY, LEADS_LIST_QUERY_KEY } from '../queryKeys';
import { updateLeadStatus } from './api/leads.api';
import LeadDashboard from './components/LeadDashboard/LeadDashboard';
import LeadModal from './components/LeadModal';
import SignUpLeadModal from './components/SignUpLeadModal';
import { useLeadControls } from './hooks/useLeadControls';
import { useLeads } from './hooks/useLeads';
import type { Lead, LeadStatus } from './types';
import './Leads.css';

const editableStatuses: LeadStatus[] = ['new', 'contacted', 'eligible', 'ineligible'];

export default function Leads() {
  // Services and permissions.
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');

  // Controls and remote records.
  const { programs, loading: programsLoading, error: programsError } = usePrograms();
  const controls = useLeadControls(programs, programsLoading, programsError);
  const {
    search, setSearch, queryFilters, statusFilters, programFilters, sorting,
    columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    hasActiveQueryFilters,
  } = controls;
  const { leads, loading, refreshing, error, hasNextPage, loadingNextPage, loadNextPage } = useLeads(queryFilters, sorting);

  // Selection and dialogs.
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);
  const {
    selectedItem: selectedLead,
    selectedKey: selectedLeadId,
    selectItem: selectLead,
  } = useTableSelection(leads);
  const [signUpTarget, setSignUpTarget] = useState<Lead | null>(null);

  // Mutations and cache reconciliation.
  const setStatus = async (lead: Lead, status: LeadStatus) => {
    await updateLeadStatus(lead.id, status);
    await queryClient.invalidateQueries({ queryKey: LEADS_LIST_QUERY_KEY });
  };

  const reconcileSignUp = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: LEADS_LIST_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
    ]);
  };

  const requestSignUp = (lead: Lead) => setSignUpTarget(lead);

  // Table presentation.
  const columns: TableColumn<Lead>[] = [
    { key: 'firstName', sortKey: 'name', header: 'First Name', render: lead => lead.youthFirstName },
    { key: 'lastName', header: 'Last Name', render: lead => lead.youthLastName },
    { key: 'school', sortKey: 'school', header: 'School', render: lead => lead.school },
    { key: 'program', sortKey: 'program', header: 'Program of Interest', render: lead => lead.programOfInterestName ?? '—' },
    { key: 'status', sortKey: 'status', header: 'Status', width: 120, render: lead => <span className={`status-badge status-${lead.status}`}>{title(lead.status)}</span> },
    { key: 'created', sortKey: 'createdAt', header: 'Created', width: 130, render: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{
      key: 'actions' as const,
      width: 40,
      resizable: false,
      header: '',
      className: 'col-actions',
      render: (lead: Lead) => lead.status === 'signed_up'
        ? null
        : <ActionsMenu
          ariaLabel={`More actions for ${lead.youthFirstName} ${lead.youthLastName}`}
          items={[
            { id: 'edit', label: 'Edit', onClick: () => setModalTarget(lead) },
            { id: 'sign-up', label: 'Sign Up', onClick: () => requestSignUp(lead) },
            ...editableStatuses.filter(status => status !== lead.status).map(status => ({ id: status, label: `Mark ${title(status)}`, onClick: () => void setStatus(lead, status) })),
          ]}
        />,
    }] : []),
  ];

  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title="Leads"
        actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
        search={<SearchInput
          label="Search leads"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search youth or school"
        />}
        columns={<ColumnVisibilityMenu
          columns={columns}
          hiddenColumnKeys={hiddenColumns}
          onHiddenColumnKeysChange={controls.setHiddenColumns}
        />}
        filters={<FilterCard
          categories={filterCategories}
          values={{ status: statusFilters, program: programFilters }}
          onApply={controls.applyFilter}
          onClearAll={controls.clearFilters}
        />}
      />
      {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
      {programsError && <p className="form-error" role="alert">{programsError}</p>}
      <PageBody
        ariaLabel="Leads"
        table={<Table
          ariaLabel="Leads"
          columns={columns}
          hiddenColumnKeys={hiddenColumns}
          data={leads}
          loading={loading}
          refreshing={refreshing}
          error={error ?? undefined}
          emptyMessage={hasActiveQueryFilters
            ? 'No leads match these filters'
            : 'No leads yet'}
          keyExtractor={lead => lead.id}
          selectedKey={selectedLeadId}
          onRowSelect={selectLead}
          sorting={sorting}
          onSortingChange={controls.setSorting}
          columnWidths={columnWidths}
          onColumnWidthsChange={controls.setColumnWidths}
          hasNextPage={hasNextPage}
          loadingNextPage={loadingNextPage}
          onLoadNextPage={loadNextPage}
        />}
        dashboard={<LeadDashboard lead={selectedLead} canWrite={canWrite} />}
      />
    </main>
    <LeadModal
      isOpen={modalTarget !== null}
      lead={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
      onClose={() => setModalTarget(null)}
      onSuccess={() => { setModalTarget(null); void queryClient.invalidateQueries({ queryKey: LEADS_LIST_QUERY_KEY }); }}
    />
    <SignUpLeadModal
      lead={signUpTarget}
      onClose={() => setSignUpTarget(null)}
      onSuccess={reconcileSignUp}
    />
  </>;
}

function title(value: string) {
  return value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}
