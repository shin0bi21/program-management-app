import PrimaryContactDashboardCard from '../../../../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import IntakeInformationDashboardCard from './IntakeInformationDashboardCard';
import type { Lead } from '../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard/LeadNotesDashboardCard';

export default function LeadDashboard({ lead, canWrite }: { lead: Lead | null; canWrite: boolean }) {
  return <>
    <PrimaryContactDashboardCard contact={lead ? {
      phoneNumber: lead.contactPhoneNumber,
      relationship: lead.contactRelationship,
    } : null} selected={lead !== null} />
    <IntakeInformationDashboardCard notes={lead?.notes} selected={lead !== null} />
    <LeadNotesDashboardCard lead={lead} canWrite={canWrite} />
  </>;
}
