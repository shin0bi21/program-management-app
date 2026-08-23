import { useCallback, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal } from '../../../common/components/Modal/hooks/useConfirmModal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import type { CellContext } from '@tanstack/react-table';
import type { TableColumnDef } from '../../../common/components/Table/Table.types';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { formatShortDate } from '../../../common/utils/date';
import LeadDashboard from './components/LeadDashboard/LeadDashboard';
import LeadTable from './components/LeadTable/LeadTable';
import LeadModal from './components/LeadModal/LeadModal';
import SignUpLeadModal from './components/SignUpLeadModal/SignUpLeadModal';
import { useLeadControls } from './hooks/useLeadControls';
import useLeadActions from './hooks/useLeadActions';
import { LEAD_TABLE_KEYS, type Lead, type LeadOrigin, type LeadStatus } from './types';
import './Leads.css';

const editableStatuses: LeadStatus[] = ['contacted', 'eligible', 'ineligible'];
const LEAD_SIGNUP_COHORTS_QUERY_KEY = ['lead-signup-cohorts'] as const;

export default function Leads({ origin }: { origin: LeadOrigin }) {
  const viewTitle = origin === 'external' ? 'External Leads' : 'Internal Leads';
  const preferenceKey = origin === 'external' ? 'outreach-external-leads-filters' : 'outreach-internal-leads-filters';
  const tableQueryKey = ['leads', origin, 'table'] as const;
  // Services and permissions.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');

  // Controls and remote records.
  const { programs, loading: programsLoading, error: programsError } = usePrograms();
  const controls = useLeadControls(
    origin,
    preferenceKey,
    programs,
    programsLoading,
    programsError,
    LEAD_TABLE_KEYS,
  );
  const {
    search, setSearch, appliedSearch, applySearch, clearSearch, queryFilters, statusFilters, programFilters, sorting,
    columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    ready: controlsReady,
  } = controls;
  // Selection and dialogs.
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const selectedLeadId = selectedLead?.id ?? null;
  const [signUpTarget, setSignUpTarget] = useState<Lead | null>(null);
  const syncSelectedLead = useCallback((lead: Lead) => {
    setSelectedLead(current => current?.id === lead.id ? lead : current);
  }, []);
  const removeSelectedLead = useCallback((leadId: string) => {
    setSelectedLead(current => current?.id === leadId ? null : current);
  }, []);
  const actions = useLeadActions({
    tableQueryKey,
    onLeadSynced: syncSelectedLead,
    onLeadRemoved: removeSelectedLead,
  });
  const confirmModal = useConfirmModal({ action: actions.confirmAction, onClose: actions.closeConfirmation });

  // Mutations and cache reconciliation.
  const requestSignUp = (lead: Lead) => setSignUpTarget(lead);

  // Table presentation.
  const columns: TableColumnDef<Lead>[] = [
    { id: 'firstName', header: 'First Name', accessorFn: lead => lead.youthFirstName },
    { id: 'lastName', header: 'Last Name', accessorFn: lead => lead.youthLastName },
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

  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title={viewTitle}
        actions={canWrite && origin === 'internal' ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
        search={<SearchInput
          label="Search leads"
          value={search}
          appliedValue={appliedSearch}
          onChange={event => setSearch(event.target.value)}
          onApply={applySearch}
          onClear={clearSearch}
          placeholder="Search youth or school"
        />}
        columns={controlsReady ? <ColumnVisibilityMenu
          columns={columns}
          hiddenColumnKeys={hiddenColumns}
          onHiddenColumnKeysChange={controls.setHiddenColumns}
        /> : undefined}
        filters={controlsReady ? <FilterCard
          categories={filterCategories}
          values={{ status: statusFilters, program: programFilters }}
          onApply={controls.applyFilter}
          onClearAll={controls.clearFilters}
        /> : undefined}
      />
      {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
      {programsError && <p className="form-error" role="alert">{programsError}</p>}
      {actions.actionError && <p className="form-error" role="alert">{actions.actionError}</p>}
      {!controlsReady ? <p role="status">Loading saved lead preferences…</p> : <PageBody
        ariaLabel={viewTitle}
        table={<LeadTable
          queryKey={tableQueryKey}
          columns={columns}
          hiddenColumnKeys={hiddenColumns}
          filters={queryFilters}
          sorting={sorting}
          columnWidths={columnWidths}
          selectedLeadId={selectedLeadId}
          onLeadSelect={setSelectedLead}
          onSortingChange={controls.setSorting}
          onColumnWidthsChange={controls.setColumnWidths}
        />}
        dashboard={<LeadDashboard lead={selectedLead} canWrite={canWrite} />}
      />}
    </main>
    <LeadModal
      isOpen={modalTarget !== null}
      lead={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
      onClose={() => setModalTarget(null)}
      onSuccess={savedLead => {
        if (modalTarget === 'new') void actions.refreshLeads();
        else actions.syncLead(savedLead);
      }}
    />
    <SignUpLeadModal
      queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY}
      lead={signUpTarget}
      onClose={() => setSignUpTarget(null)}
      onSuccess={actions.reconcileSignUp}
    />
    <Modal
      isOpen={actions.confirmAction !== null}
      onClose={actions.closeConfirmation}
      title={actions.confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {actions.confirmAction && <p>{actions.confirmAction.message}</p>}
    </Modal>
  </>;
}

function title(value: string) {
  return value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}
