import { useState } from 'react';
import { useAuth } from '../../auth/authContext';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../common/components/FilterCard/FilterCard';
import PageBody from '../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import type { CellContext } from '@tanstack/react-table';
import type { TableColumnDef } from '../../common/components/Table/Table.types';
import { formatShortDate } from '../../common/utils/date';
import LeadDashboard from './components/LeadDashboard/LeadDashboard';
import LeadTable from './components/LeadTable/LeadTable';
import LeadModal from './components/LeadModal/LeadModal';
import SignUpLeadModal from './components/SignUpLeadModal/SignUpLeadModal';
import useLeadActions from './hooks/actions/useLeadActions';
import useLeadData from './hooks/data/useLeadData';
import { useLeadPreferences } from './hooks/preferences/useLeadPreferences';
import useLeadSelection from './hooks/selection/useLeadSelection';
import { LEAD_TABLE_KEYS, type Lead, type LeadOrigin, type LeadStatus } from './types';
import './Leads.css';

const editableStatuses: LeadStatus[] = ['contacted', 'eligible', 'ineligible'];
const LEAD_SIGNUP_COHORTS_QUERY_KEY = ['lead-signup-cohorts'] as const;

export default function Leads({ origin }: { origin: LeadOrigin }) {
  // Page-local errors.
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);
  const [dashboardError, setDashboardError] = useState<PageErrorItem | null>(null);

  // Permissions and services.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');

  // Page data and preferences.
  const preferenceKey = origin === 'external' ? 'outreach-external-leads-filters' : 'outreach-internal-leads-filters';
  const tableQueryKey = ['leads', origin, 'table'] as const;
  const data = useLeadData();
  const preferences = useLeadPreferences(
    origin,
    preferenceKey,
    data.programs,
    data.programsLoading,
    data.programsError,
    LEAD_TABLE_KEYS,
  );

  // Selection and actions.
  const selection = useLeadSelection();
  const actions = useLeadActions({
    tableQueryKey,
    onLeadSynced: selection.syncSelectedLead,
    onLeadRemoved: selection.removeSelectedLead,
  });

  // Lead modal.
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);
  const closeLeadModal = () => setModalTarget(null);

  // Sign-up modal.
  const [signUpTarget, setSignUpTarget] = useState<Lead | null>(null);
  const requestSignUp = (lead: Lead) => setSignUpTarget(lead);
  const closeSignUpModal = () => setSignUpTarget(null);

  // Table configuration.
  const columns: TableColumnDef<Lead>[] = [
    { id: 'firstName', header: 'First Name', accessorFn: lead => lead.youthFirstName },
    { id: 'lastName', header: 'Last Name', accessorFn: lead => lead.youthLastName },
    ...(origin === 'external' ? [{
      id: 'submittedByRole',
      header: 'Filled Out By',
      accessorFn: (lead: Lead) => title(lead.submittedByRole),
    }] : []),
    { id: 'school', header: 'School', accessorFn: lead => lead.school },
    { id: 'program', header: 'Eligible Program', accessorFn: lead => lead.recommendedProgramName ?? '—' },
    {
      id: 'status',
      header: 'Status',
      size: 120,
      accessorFn: lead => lead.status,
      cell: ({ row: { original: lead } }) => <span className={`status-badge status-${lead.status}`}>{title(lead.status)}</span>,
    },
    { id: 'created', header: 'Created', size: 130, accessorFn: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{
      id: 'actions' as const,
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',

      cell: ({ row: { original: lead } }: CellContext<Lead, unknown>) => lead.status === 'signed_up' ? null : <ActionsMenu
          ariaLabel={`More actions for ${lead.youthFirstName} ${lead.youthLastName}`}
          items={[
            { id: 'edit', label: 'Edit', onClick: () => setModalTarget(lead) },
            { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => actions.requestDelete(lead) },
            ...editableStatuses.filter(status => status !== lead.status).map((status, index) => ({
              id: status,
              label: `Mark ${title(status)}`,
              groupStart: index === 0,
              onClick: () => void actions.setStatus(lead, status),
            })),
            { id: 'sign-up', label: 'Sign Up', onClick: () => requestSignUp(lead) },
          ]}
        />,
    }] : []),
  ];

  // Derived presentation.
  const viewTitle = origin === 'external' ? 'External Leads' : 'Internal Leads';

  // Render.
  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title={viewTitle}
        actions={canWrite && origin === 'internal' ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
        search={<SearchInput
          label="Search leads"
          value={preferences.search.value}
          appliedValue={preferences.search.appliedValue}
          onChange={event => preferences.search.setValue(event.target.value)}
          onApply={preferences.search.apply}
          onClear={preferences.search.clear}
          placeholder="Search youth or school"
        />}
        columns={preferences.ready ? <ColumnVisibilityMenu
          columns={columns}
          hiddenColumnKeys={preferences.table.hiddenColumns}
          onHiddenColumnKeysChange={preferences.table.setHiddenColumns}
        /> : undefined}
        filters={preferences.ready ? <FilterCard
          categories={preferences.filters.definitions}
          values={{
            status: preferences.filters.statuses,
            program: preferences.filters.programIds,
            submitterRole: preferences.filters.submitterRoles,
          }}
          onApply={preferences.filters.apply}
          onClearAll={preferences.filters.clear}
        /> : undefined}
      />
      <PageErrorOverlay errors={[preferences.error, data.programsError, actions.actionError, viewError, dashboardError]} />
      {!preferences.ready ? <p role="status">Loading saved lead preferences…</p> : <PageBody
        ariaLabel={viewTitle}
        table={<LeadTable
          queryKey={tableQueryKey}
          columns={columns}
          hiddenColumnKeys={preferences.table.hiddenColumns}
          filters={preferences.filters.query}
          sorting={preferences.table.sorting}
          columnWidths={preferences.table.columnWidths}
          selectedLeadId={selection.selectedLeadId}
          onLeadSelect={selection.selectLead}
          onSortingChange={preferences.table.setSorting}
          onColumnWidthsChange={preferences.table.setColumnWidths}
          onErrorChange={setViewError}
        />}
        dashboard={<LeadDashboard lead={selection.selectedLead} canWrite={canWrite} onErrorChange={setDashboardError} />}
      />}
    </main>
    <LeadModal
      isOpen={modalTarget !== null}
      lead={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
      onClose={closeLeadModal}
      onSuccess={savedLead => {
        if (modalTarget === 'new') void actions.refreshLeads();
        else actions.syncLead(savedLead);
      }}
    />
    <SignUpLeadModal
      queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY}
      lead={signUpTarget}
      onClose={closeSignUpModal}
      onSuccess={actions.reconcileSignUp}
    />
    <ConfirmModal
      action={actions.confirmAction}
      onClose={actions.closeConfirmation}
    />
  </>;
}

function title(value: string) {
  return value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}
