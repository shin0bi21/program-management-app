import { useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import './TimesheetOverviewCard.css';

interface TimesheetOverviewCardProps {
  title: string;
  total: number;
  context: string;
  breakdown: Array<[string, number]>;
  emptyMessage: string;
  hasStaff: boolean;
}

export default function TimesheetOverviewCard({
  title,
  total,
  context,
  breakdown,
  emptyMessage,
  hasStaff,
}: TimesheetOverviewCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  return (
    <>
      <DashboardCard
        title={title}
        emptyMessage={emptyMessage}
        action={hasStaff ? (
          <Button
            size="sm"
            variant="secondary"
            aria-haspopup="dialog"
            onClick={() => setBreakdownOpen(true)}
          >
            See Breakdown
          </Button>
        ) : undefined}
      >
        {hasStaff ? (
          <>
            <strong className="timesheet-overview-card__metric">{total.toFixed(2)}</strong>
            <span className="timesheet-overview-card__context">{context}</span>
          </>
        ) : undefined}
      </DashboardCard>
      <Modal
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        title={`${title} Breakdown`}
      >
        <div className="timesheet-overview-card__modal-summary">
          <strong className="timesheet-overview-card__metric">{total.toFixed(2)}</strong>
          <span className="timesheet-overview-card__context">{context}</span>
        </div>
        <dl className="timesheet-overview-card__breakdown">
          {breakdown.map(([label, hours]) => (
            <div key={label}><dt>{label}</dt><dd>{hours.toFixed(2)}</dd></div>
          ))}
        </dl>
      </Modal>
    </>
  );
}
