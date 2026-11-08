import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/authContext';
import Button from '../../common/components/Button/Button';
import PageContainer from '../../common/components/PageContainer/PageContainer';
import ConfirmModal from '../../common/components/ConfirmModal/ConfirmModal';
import { type PageMessageValue } from '../../common/components/PageMessageOverlay/PageMessageOverlay';
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

/**
 * Displays outreach leads with current saved selection and independent edit drafts.
 * @param props - The internal or external outreach collection to display.
 * @example <Leads origin="external" />
 */
export default function Leads({ origin }: { origin: LeadOrigin }) {
  // Page-local errors.
  const [viewError, setViewError] = useState<PageMessageValue>(null);
  const [dashboardError, setDashboardError] = useState<PageMessageValue>(null);

  // Permissions and services.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');

  // Page data and preferences.
  const preferenceKey = origin === 'external' ? 'outreach-external-leads-filters' : 'outreach-internal-leads-filters';
  const tableQueryKey = ['leads', 'table', origin] as const;
  const data = useLeadData();
  const { records } = data;
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
    statuses: preferences.filters.values.statuses,
    programIds: preferences.filters.values.programIds,
    origins: [origin],
    submitterRoles: preferences.filters.values.submitterRoles,
  } : null, [origin, preferences.filters.values.programIds, preferences.filters.values.statuses, preferences.filters.values.submitterRoles, preferences.ready, preferences.search.appliedValue]);

  // Selection and actions.
  const selection = useLeadSelection(records);
  const actions = useLeadActions({
    tableQueryKey,
    onLeadRemoved: selection.removeSelectedLead,
  });

  // Lead modal.
  const [modalTarget, setModalTarget] = useState<string | null>(null);
  const modalLead = modalTarget ? records[modalTarget] : undefined;
  const closeLeadModal = () => setModalTarget(null);

  // Sign-up modal.
  const [signUpTarget, setSignUpTarget] = useState<string | null>(null);
  const requestSignUp = (lead: Lead) => setSignUpTarget(lead.id);
  const closeSignUpModal = () => setSignUpTarget(null);

  // Table configuration.
  const { columns } = useLeadTable({
    origin,
    canWrite,
    onEdit: lead => setModalTarget(lead.id),
    onDelete: actions.requestDelete,
    onSignUp: requestSignUp,
    onStatusChange: actions.setStatus,
  });

  // Derived presentation.
  const viewTitle = origin === 'external' ? 'External Leads' : 'Internal Leads';

  // Render.
  return <>
    <PageContainer
      title={viewTitle}
      ariaLabel={viewTitle}
      controls={preferences}
      loadingLabel="Loading saved lead preferences…"
      actions={canWrite && origin === 'internal' ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
      search={{ label: 'Search leads', placeholder: 'Search youth or school' }}
      columns={columns}
      messages={[preferences.error, data.programsError, actions.actionError, viewError, dashboardError]}
      dashboard={<LeadDashboard
        lead={selection.selectedLead}
        canWrite={canWrite}
        onMessageChange={setDashboardError}
      />}
      table={<LeadTable
        records={records}
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
    />
    <LeadModal
      isOpen={modalTarget === 'new' || Boolean(modalLead)}
      lead={modalLead}
      onClose={closeLeadModal}
      onSuccess={savedLead => {
        actions.syncLead(savedLead);
        if (modalTarget === 'new') void actions.refreshLeads();
      }}
    />
    <SignUpLeadModal
      queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY}
      lead={signUpTarget ? records[signUpTarget] ?? null : null}
      onClose={closeSignUpModal}
      onSuccess={actions.reconcileSignUp}
    />
    <ConfirmModal
      action={actions.confirmAction}
      onClose={actions.closeConfirmation}
    />
  </>;
}
