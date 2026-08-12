import PrimaryContactDashboardCard from '../../../../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import NotesDashboardCard from '../../../common/components/NotesDashboardCard/NotesDashboardCard';
import type { Lead } from '../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard/LeadNotesDashboardCard';

export default function LeadDashboard({ lead, canWrite }: { lead: Lead | null; canWrite: boolean }) {
  return <>
    <PrimaryContactDashboardCard contact={lead ? {
      phoneNumber: lead.contactPhoneNumber,
      relationship: lead.contactRelationship,
    } : null} selected={lead !== null} />
    <NotesDashboardCard notes={lead?.notes} selected={lead !== null} />
    <LeadNotesDashboardCard lead={lead} canWrite={canWrite} />
  </>;
}
