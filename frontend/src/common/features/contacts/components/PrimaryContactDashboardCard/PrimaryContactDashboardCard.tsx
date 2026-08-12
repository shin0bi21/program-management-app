import type { ReactNode } from 'react';
import { DashboardCard } from '../../../../components/DashboardCard/DashboardCard';
import './PrimaryContactDashboardCard.css';

interface PrimaryContactDashboardCardProps {
  contact: {
    phoneNumber?: string | null;
    relationship?: string | null;
  } | null;
  selected: boolean;
  action?: ReactNode;
}

const relationshipLabel = (value?: string | null) => value
  ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
  : '—';

export default function PrimaryContactDashboardCard({ contact, selected, action }: PrimaryContactDashboardCardProps) {
  return (
    <DashboardCard
      title="Primary Contact"
      emptyMessage={selected ? 'No primary contact recorded.' : 'Select a row to view the primary contact.'}
      className="primary-contact-card"
      action={action}
    >
      {contact ? (
        <p className="primary-contact-card__summary">
          <span>{contact.phoneNumber || '—'}</span>
          <span>{relationshipLabel(contact.relationship)}</span>
        </p>
      ) : undefined}
    </DashboardCard>
  );
}
