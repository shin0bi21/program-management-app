import PrimaryContactDashboardCard from '../../../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import IntakeInformationDashboardCard from './IntakeInformationDashboardCard';
import type { Lead } from '../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard/LeadNotesDashboardCard';
import type { PageErrorChangeHandler } from '../../../../common/components/PageErrorOverlay/usePageErrorReporter';

export default function LeadDashboard({ lead, canWrite, onAddStatusUpdate, onErrorChange }: {
  lead: Lead | null;
  canWrite: boolean;
  onAddStatusUpdate: (lead: Lead) => void;
  onErrorChange?: PageErrorChangeHandler;
}) {
  return <>
    <PrimaryContactDashboardCard contact={lead ? {
      phoneNumber: lead.contactPhoneNumber,
      relationship: lead.contactRelationship,
    } : null} selected={lead !== null} />
    <IntakeInformationDashboardCard notes={lead?.notes} selected={lead !== null} />
    <LeadNotesDashboardCard lead={lead} canWrite={canWrite} onAddStatusUpdate={onAddStatusUpdate} onErrorChange={onErrorChange} />
  </>;
}
