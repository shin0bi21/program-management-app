import type { ReactNode } from 'react';
import './DashboardCard.css';

export function DashboardCard({
  title,
  children,
  emptyMessage,
  className,
  action,
}: {
  title?: string;
  children?: ReactNode;
  emptyMessage?: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <article className={['dashboard-card', className].filter(Boolean).join(' ')}>
      {(title || action) && (
        <div className="dashboard-card__header">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      <div className="dashboard-card__content">
        {children ?? (
          <p className="dashboard-card__empty">{emptyMessage ?? 'No data available.'}</p>
        )}
      </div>
    </article>
  );
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
