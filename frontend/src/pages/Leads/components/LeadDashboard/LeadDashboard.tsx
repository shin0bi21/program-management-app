import PrimaryContactDashboardCard from '../../../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import IntakeInformationDashboardCard from './IntakeInformationDashboardCard';
import type { Lead } from '../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard/LeadNotesDashboardCard';
import type { PageMessageChangeHandler } from '../../../../common/components/PageMessageOverlay/usePageMessageReporter';

export default function LeadDashboard({ lead, canWrite, onMessageChange }: {
  lead: Lead | null;
  canWrite: boolean;
  onMessageChange?: PageMessageChangeHandler;
}) {
  return <>
    <PrimaryContactDashboardCard contact={lead ? {
      phoneNumber: lead.contactPhoneNumber,
      relationship: lead.contactRelationship,
    } : null} selected={lead !== null} />
    <IntakeInformationDashboardCard notes={lead?.notes} selected={lead !== null} />
    <LeadNotesDashboardCard lead={lead} canWrite={canWrite} onMessageChange={onMessageChange} />
  </>;
}
