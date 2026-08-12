import { useState } from 'react';
import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import './TimesheetDashboardCard.css';

interface EmptyTimesheetDashboardCardProps {
  title?: string;
  emptyMessage: string;
}

interface ReadyTimesheetDashboardCardProps extends EmptyTimesheetDashboardCardProps {
  total: number;
  modalTitle: string;
  modalSubtitle: string;
  breakdown: Array<[string, number]>;
  details?: Array<[string, string]>;
}

type TimesheetDashboardCardProps = EmptyTimesheetDashboardCardProps | ReadyTimesheetDashboardCardProps;

const compactDetailLabels = new Set(['Current Pay Period', 'Cycle']);

export default function TimesheetDashboardCard(props: TimesheetDashboardCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const hasData = 'total' in props;
  const { title, emptyMessage } = props;
  const total = hasData ? props.total : 0;
  const modalTitle = hasData ? props.modalTitle : '';
  const modalSubtitle = hasData ? props.modalSubtitle : '';
  const breakdown = hasData ? props.breakdown : [];
  const details = hasData ? props.details : undefined;
  const breakdownAction = hasData ? (
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
          {title && <h2 className="timesheet-overview-card__accessible-title">{title}</h2>}
          {hasData ? (
            <div className="dashboard-card__compact-layout timesheet-overview-card__layout">
              <dl className="timesheet-overview-card__details">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className={compactDetailLabels.has(label) ? 'timesheet-overview-card__text-value' : undefined}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="dashboard-card__compact-action timesheet-overview-card__action">{breakdownAction}</div>
            </div>
          ) : <p className="dashboard-card__empty">{emptyMessage}</p>}
        </article>
      ) : (
        <DashboardCard
          title={title}
          className="timesheet-overview-card"
          emptyMessage={emptyMessage}
          action={breakdownAction}
        >
          {hasData ? (
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
        {hasData && breakdown.length ? (
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
        {hasData && <div className="timesheet-overview-card__total"><span>Total</span><strong>{total.toFixed(2)}</strong></div>}
      </Modal>
    </>
  );
}
