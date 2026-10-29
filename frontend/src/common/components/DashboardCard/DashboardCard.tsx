import type { ReactNode } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './DashboardCard.css';

export function DashboardCard({
  title,
  children,
  emptyMessage,
  className,
  action,
  loading = false,
  loadingLabel,
}: {
  title?: string;
  children?: ReactNode;
  emptyMessage?: string;
  className?: string;
  action?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <article className={['dashboard-card', className].filter(Boolean).join(' ')} aria-busy={loading}>
      {(title || action) && (
        <div className="dashboard-card__header">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      <div className="dashboard-card__content">
        {loading ? <DashboardCardLoading label={loadingLabel} /> : children ?? (
          <p className="dashboard-card__empty">{emptyMessage ?? 'No data available.'}</p>
        )}
      </div>
    </article>
  );
}

export function DashboardCardLoading({ label = 'Loading dashboard data…' }: { label?: string }) {
  return <div className="dashboard-card__loading" role="status" aria-label={label}>
    <LoadingSpinner size="sm" />
  </div>;
}

export function DashboardCardGroup({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="dashboard-card-group" aria-label={ariaLabel}>
      {children}
    </section>
  );
}
