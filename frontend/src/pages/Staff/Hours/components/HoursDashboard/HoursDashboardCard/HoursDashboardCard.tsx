import { useEffect, useState } from 'react';
import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard, DashboardCardLoading } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import './HoursDashboardCard.css';

interface EmptyHoursDashboardCardProps {
  title?: string;
  emptyMessage: string;
  loading?: boolean;
  scopeKey?: string;
  details?: Array<[string, string | null]>;
  unavailable?: {
    title: string;
    onRetry?: () => void;
  };
}

interface ReadyHoursDashboardCardProps extends EmptyHoursDashboardCardProps {
  total: number;
  modalTitle: string;
  modalSubtitle: string;
  breakdown: Array<[string, number]>;
}

type HoursDashboardCardProps = EmptyHoursDashboardCardProps | ReadyHoursDashboardCardProps;

export default function HoursDashboardCard(props: HoursDashboardCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState<string | null>(null);
  const hasData = 'total' in props;
  const { title, emptyMessage, unavailable, loading = false, scopeKey = '' } = props;

  useEffect(() => setBreakdownOpen(null), [scopeKey]);

  const total = hasData ? props.total : 0;
  const modalTitle = hasData ? props.modalTitle : '';
  const modalSubtitle = hasData ? props.modalSubtitle : '';
  const breakdown = hasData ? props.breakdown : [];
  const details = props.details;
  const breakdownAction = hasData || loading || details ? (
    <Button
      size="sm"
      variant="secondary"
      aria-haspopup="dialog"
      disabled={!hasData || loading}
      onClick={() => setBreakdownOpen(scopeKey)}
    >
      See Breakdown
    </Button>
  ) : undefined;

  return (
    <>
      {details ? (
        <article className="dashboard-card dashboard-card--short hours-overview-card hours-overview-card--details" aria-busy={loading || undefined}>
          {title && <h2 className="hours-overview-card__accessible-title">{title}</h2>}
          <div className="dashboard-card__compact-layout hours-overview-card__layout">
            <div>
              <dl className="hours-overview-card__details">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {loading ? <DashboardCardLoading label={`Loading ${label.toLowerCase()}…`} /> : value ?? '—'}
                    </dd>
                  </div>
                ))}
              </dl>
              {unavailable ? <UnavailableState compact {...unavailable} /> : !hasData && !loading ? <p className="dashboard-card__empty">{emptyMessage}</p> : null}
            </div>
            <div className="dashboard-card__compact-action hours-overview-card__action">{breakdownAction}</div>
          </div>
        </article>
      ) : (
        <DashboardCard
          title={title}
          className="dashboard-card--short hours-overview-card"
          emptyMessage={emptyMessage}
          action={breakdownAction}
        >
          {unavailable ? <UnavailableState compact {...unavailable} /> : hasData ? (
            <>
              <strong className="hours-overview-card__metric">{total.toFixed(2)}</strong>
              <span className="hours-overview-card__context">{modalSubtitle}</span>
            </>
          ) : undefined}
        </DashboardCard>
      )}
      <Modal
        isOpen={breakdownOpen === scopeKey && hasData && !loading}
        onClose={() => setBreakdownOpen(null)}
        title={modalTitle}
        maxWidth="440px"
      >
        <p className="hours-overview-card__modal-subtitle">{modalSubtitle}</p>
        {hasData && breakdown.length ? (
          <>
            <div
              className="hours-overview-card__segments"
              role="img"
              aria-label={`Breakdown of ${total.toFixed(2)} hours`}
            >
              {breakdown.map(([label, hours], index) => (
                <span
                  key={label}
                  className={`hours-overview-card__tone-${index % 5}`}
                  style={{ width: `${total > 0 ? (hours / total) * 100 : 0}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <dl className="hours-overview-card__breakdown">
              {breakdown.map(([label, hours], index) => (
                <div key={label} className={`hours-overview-card__breakdown-row hours-overview-card__tone-${index % 5}`}>
                  <dt>{label}</dt>
                  <dd>{hours.toFixed(2)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : <p className="hours-overview-card__no-breakdown">No hours recorded.</p>}
        {hasData && <div className="hours-overview-card__total"><span>Total</span><strong>{total.toFixed(2)}</strong></div>}
      </Modal>
    </>
  );
}
