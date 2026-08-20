import { useState } from 'react';
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
import type { TableColumn } from '../../../common/components/Table/Table';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import { formatShortDate } from '../../../common/utils/date';
import LeadDashboard from './components/LeadDashboard/LeadDashboard';
import LeadTableView from './components/LeadTableView/LeadTableView';
import LeadModal from './components/LeadModal/LeadModal';
import SignUpLeadModal from './components/SignUpLeadModal/SignUpLeadModal';
import { useLeadControls } from './hooks/useLeadControls';
import useLeadActions from './hooks/useLeadActions';
import type { Lead, LeadOrigin, LeadStatus } from './types';
import './Leads.css';

const editableStatuses: LeadStatus[] = ['contacted', 'eligible', 'ineligible'];
const LEAD_COLUMN_KEYS = ['firstName', 'lastName', 'origin', 'school', 'program', 'status', 'created'] as const;
const LEAD_SORT_KEYS = ['name', 'school', 'program', 'status', 'createdAt'] as const;
const LEAD_SIGNUP_COHORTS_QUERY_KEY = ['lead-signup-cohorts'] as const;

export default function Leads({ origin }: { origin: LeadOrigin }) {
  const viewTitle = origin === 'external' ? 'External Leads' : 'Internal Leads';
  const preferenceKey = origin === 'external' ? 'outreach-external-leads-filters' : 'outreach-internal-leads-filters';
  const listQueryKey = ['leads', origin, 'list'] as const;
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
    LEAD_COLUMN_KEYS,
    LEAD_SORT_KEYS,
  );
  const {
    search, setSearch, queryFilters, statusFilters, programFilters, sorting,
    columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    ready: controlsReady,
  } = controls;
  const actions = useLeadActions(listQueryKey);

  // Selection and dialogs.
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const selectedLeadId = selectedLead?.id ?? null;
  const [signUpTarget, setSignUpTarget] = useState<Lead | null>(null);
  const confirmModal = useConfirmModal({ action: actions.confirmAction, onClose: actions.closeConfirmation });

  // Mutations and cache reconciliation.
  const requestSignUp = (lead: Lead) => setSignUpTarget(lead);

  // Table presentation.
  const columns: TableColumn<Lead>[] = [
    { key: 'firstName', sortKey: 'name', header: 'First Name', render: lead => lead.youthFirstName },
    { key: 'lastName', header: 'Last Name', render: lead => lead.youthLastName },
    { key: 'origin', header: 'Origin', width: 100, render: lead => title(lead.origin) },
    { key: 'school', sortKey: 'school', header: 'School', render: lead => lead.school },
    { key: 'program', sortKey: 'program', header: 'Eligible Program', render: lead => lead.recommendedProgramName ?? '—' },
    { key: 'status', sortKey: 'status', header: 'Status', width: 120, render: lead => <span className={`status-badge status-${lead.status}`}>{title(lead.status)}</span> },
    { key: 'created', sortKey: 'createdAt', header: 'Created', width: 130, render: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{
      key: 'actions' as const,
      width: 40,
      resizable: false,
      header: '',
      className: 'col-actions',
      render: (lead: Lead) => lead.status === 'signed_up' ? null : <ActionsMenu
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
          onChange={event => setSearch(event.target.value)}
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
      {!controlsReady ? <p role="status">Loading saved lead preferences…</p> : <PageBody
        ariaLabel={viewTitle}
        table={<LeadTableView
          queryKey={listQueryKey}
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
      onSuccess={() => { void actions.refreshLeads(); }}
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
