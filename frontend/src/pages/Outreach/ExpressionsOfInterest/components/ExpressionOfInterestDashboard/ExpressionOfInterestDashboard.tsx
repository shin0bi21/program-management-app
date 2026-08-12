import PrimaryContactDashboardCard from '../../../../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import NotesDashboardCard from '../../../common/components/NotesDashboardCard/NotesDashboardCard';
import type { ExpressionOfInterest } from '../../types';

export default function ExpressionOfInterestDashboard({
  submission,
}: {
  submission: ExpressionOfInterest | null;
}) {
  return <>
    <PrimaryContactDashboardCard contact={submission ? {
      phoneNumber: submission.contactPhoneNumber,
      relationship: submission.contactRelationship,
    } : null} selected={submission !== null} />
    <NotesDashboardCard notes={submission?.notes} selected={submission !== null} />
  </>;
}
