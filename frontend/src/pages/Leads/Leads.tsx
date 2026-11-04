import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/authContext';
import Button from '../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../common/components/FilterCard/FilterCard';
import PageBody from '../../common/components/PageBody/PageBody';
import PageMessageOverlay, { type PageMessageValue } from '../../common/components/PageMessageOverlay/PageMessageOverlay';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import SearchInput from '../../common/components/SearchInput/SearchInput';
import LeadDashboard from './components/LeadDashboard/LeadDashboard';
import LeadTable from './components/LeadTable/LeadTable';
import useLeadTable from './components/LeadTable/hooks/useLeadTable';
import LeadModal from './components/LeadModal/LeadModal';
import SignUpLeadModal from './components/SignUpLeadModal/SignUpLeadModal';
import useLeadActions from './hooks/actions/useLeadActions';
import useLeadData from './hooks/data/useLeadData';
import { useLeadPreferences } from './hooks/preferences/useLeadPreferences';
import useLeadSelection from './hooks/selection/useLeadSelection';
import { LEAD_TABLE_KEYS, type Lead, type LeadFilters, type LeadOrigin } from './types';
import './Leads.css';

const LEAD_SIGNUP_COHORTS_QUERY_KEY = ['lead-signup-programCycles'] as const;
export default function Leads({ origin }: { origin: LeadOrigin }) {
  // Page-local errors.
  const [viewError, setViewError] = useState<PageMessageValue>(null);
  const [dashboardError, setDashboardError] = useState<PageMessageValue>(null);

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

  // Filter configuration.
  const leadFilters = useMemo<LeadFilters | null>(() => preferences.ready ? {
    search: preferences.search.appliedValue,
    statuses: preferences.filters.statuses,
    programIds: preferences.filters.programIds,
    origins: [origin],
    submitterRoles: preferences.filters.submitterRoles,
  } : null, [origin, preferences.filters.programIds, preferences.filters.statuses, preferences.filters.submitterRoles, preferences.ready, preferences.search.appliedValue]);

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
  const { columns } = useLeadTable({
    origin,
    canWrite,
    onEdit: setModalTarget,
    onDelete: actions.requestDelete,
    onSignUp: requestSignUp,
    onStatusChange: actions.setStatus,
  });

  // Derived presentation.
  const viewTitle = origin === 'external' ? 'External Leads' : 'Internal Leads';

  // Render.
  return <>
    <main className="page-container">
      <PageHeader
        title={viewTitle}
        actions={canWrite && origin === 'internal' ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
        search={preferences.ready ? <SearchInput
          label="Search leads"
          value={preferences.search.value}
          appliedValue={preferences.search.appliedValue}
          onChange={event => preferences.search.setValue(event.target.value)}
          onApply={preferences.search.apply}
          onClear={preferences.search.clear}
          placeholder="Search youth or school"
        /> : undefined}
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
      <PageMessageOverlay messages={[preferences.error, data.programsError, actions.actionError, viewError, dashboardError]} />
      {!preferences.ready ? <p role="status">Loading saved lead preferences…</p> : <PageBody
        ariaLabel={viewTitle}
        table={<LeadTable
          queryKey={tableQueryKey}
          columns={columns}
          hiddenColumnKeys={preferences.table.hiddenColumns}
          filters={leadFilters}
          sorting={preferences.table.sorting}
          columnWidths={preferences.table.columnWidths}
          selectedLeadId={selection.selectedLeadId}
          onLeadSelect={selection.selectLead}
          onSortingChange={preferences.table.setSorting}
          onColumnWidthsChange={preferences.table.setColumnWidths}
          onMessageChange={setViewError}
        />}
        dashboard={<LeadDashboard
          lead={selection.selectedLead}
          canWrite={canWrite}
          onMessageChange={setDashboardError}
        />}
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
