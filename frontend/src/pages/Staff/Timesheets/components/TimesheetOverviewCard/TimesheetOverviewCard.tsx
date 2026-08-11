import { useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import './TimesheetOverviewCard.css';

interface TimesheetOverviewCardProps {
  title: string;
  total: number;
  modalTitle: string;
  modalSubtitle: string;
  breakdown: Array<[string, number]>;
  emptyMessage: string;
  hasStaff: boolean;
  details?: Array<[string, string]>;
}

export default function TimesheetOverviewCard({
  title,
  total,
  modalTitle,
  modalSubtitle,
  breakdown,
  emptyMessage,
  hasStaff,
  details,
}: TimesheetOverviewCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const breakdownAction = hasStaff ? (
    <Button
      size="sm"
      variant="secondary"
      aria-haspopup="dialog"
      onClick={() => setBreakdownOpen(true)}
    >
      See Breakdown
    </Button>
  ) : undefined;

  return (
    <>
      {details ? (
        <article className="dashboard-card timesheet-overview-card timesheet-overview-card--details">
          <h2 className="timesheet-overview-card__accessible-title">{title}</h2>
          {hasStaff ? (
            <>
              <div className="timesheet-overview-card__action">{breakdownAction}</div>
              <dl className="timesheet-overview-card__details">
                {details.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            </>
          ) : <p className="dashboard-card__empty">{emptyMessage}</p>}
        </article>
      ) : (
        <DashboardCard
          title={title}
          className="timesheet-overview-card"
          emptyMessage={emptyMessage}
          action={breakdownAction}
        >
          {hasStaff ? (
            <>
              <strong className="timesheet-overview-card__metric">{total.toFixed(2)}</strong>
              <span className="timesheet-overview-card__context">{modalSubtitle}</span>
            </>
          ) : undefined}
        </DashboardCard>
      )}
      <Modal
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        title={modalTitle}
        maxWidth="440px"
      >
        <p className="timesheet-overview-card__modal-subtitle">{modalSubtitle}</p>
        {breakdown.length ? (
          <>
            <div
              className="timesheet-overview-card__segments"
              role="img"
              aria-label={`Breakdown of ${total.toFixed(2)} hours`}
            >
              {breakdown.map(([label, hours], index) => (
                <span
                  key={label}
                  className={`timesheet-overview-card__tone-${index % 5}`}
                  style={{ width: `${total > 0 ? (hours / total) * 100 : 0}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <dl className="timesheet-overview-card__breakdown">
              {breakdown.map(([label, hours], index) => (
                <div key={label}>
                  <dt><span className={`timesheet-overview-card__dot timesheet-overview-card__tone-${index % 5}`} aria-hidden="true" />{label}</dt>
                  <dd>{hours.toFixed(2)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : <p className="timesheet-overview-card__no-breakdown">No hours recorded.</p>}
        <div className="timesheet-overview-card__total"><span>Total</span><strong>{total.toFixed(2)}</strong></div>
      </Modal>
    </>
  );
}
