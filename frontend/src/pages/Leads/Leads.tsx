import { useState } from 'react';
import { useAuth } from '../../auth/authContext';
import Button from '../../common/components/Button/Button';
import PageContainer from '../../common/components/PageContainer/PageContainer';
import ConfirmModal from '../../common/components/ConfirmModal/ConfirmModal';
import { type PageMessageValue } from '../../common/components/PageMessageOverlay/PageMessageOverlay';
import PrimaryContactDashboardCard from '../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import IntakeInformationDashboardCard from './components/LeadDashboard/IntakeInformationDashboardCard';
import LeadNotesDashboardCard from './components/LeadDashboard/LeadNotesDashboardCard/LeadNotesDashboardCard';
import LeadTable from './components/LeadTable/LeadTable';
import useLeadTable from './components/LeadTable/hooks/useLeadTable';
import LeadModal from './components/LeadModal/LeadModal';
import SignUpLeadModal from './components/SignUpLeadModal/SignUpLeadModal';
import useLeadActions from './hooks/actions/useLeadActions';
import useLeadData from './hooks/data/useLeadData';
import { useLeadPreferences } from './hooks/preferences/useLeadPreferences';
import useLeadSelection from './hooks/selection/useLeadSelection';
import { LEAD_TABLE_KEYS, type Lead, type LeadOrigin } from './types';
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

  // Permissions and services.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');

  // Page data and preferences.
  const preferenceKey = origin === 'external' ? 'outreach-external-leads-filters' : 'outreach-internal-leads-filters';
  const tableQueryKey = ['leads', 'table', origin] as const;
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
    onLeadRemoved: selection.removeSelectedLead,
    onLeadSynced: selection.updateSelectedLead,
  });

  // Lead modal.
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);
  const modalLead = modalTarget && modalTarget !== 'new' ? modalTarget : undefined;
  const closeLeadModal = () => setModalTarget(null);

  // Sign-up modal.
  const [signUpTarget, setSignUpTarget] = useState<Lead | null>(null);
  const requestSignUp = (lead: Lead) => setSignUpTarget(lead);
  const closeSignUpModal = () => setSignUpTarget(null);

  // Table configuration.
  const { columns } = useLeadTable({
    origin,
    canWrite,
    onEdit: lead => setModalTarget(lead),
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
      messages={[preferences.error, data.programsError, actions.actionError, viewError]}
      dashboard={<>
        <PrimaryContactDashboardCard
          contact={selection.selectedLead ? {
            phoneNumber: selection.selectedLead.contactPhoneNumber,
            relationship: selection.selectedLead.contactRelationship,
          } : null}
          selected={selection.selectedLead !== null}
        />
        <IntakeInformationDashboardCard
          notes={selection.selectedLead?.notes}
          selected={selection.selectedLead !== null}
        />
        <LeadNotesDashboardCard
          lead={selection.selectedLead}
          canWrite={canWrite}
        />
      </>}
      table={<LeadTable
        queryKey={tableQueryKey}
        columns={columns}
        hiddenColumnKeys={preferences.table.hiddenColumns}
        filters={preferences.appliedFilters}
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
      onSuccess={lead => actions.syncLead(lead, modalTarget === 'new' ? 'create' : 'update')}
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
