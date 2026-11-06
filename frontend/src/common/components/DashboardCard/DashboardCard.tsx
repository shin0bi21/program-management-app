import type { ReactNode } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './DashboardCard.css';

/**
 * Keeps a card's header and fixed-height shell mounted while its data region changes.
 * Custom shells retain shared sizing/spacing and keep actions outside the scrolling data area.
 * @param props.children - Data or caller-rendered no-selection/error state; nullish uses emptyMessage or "No data available.".
 * @param props.loading - Replaces only the data region with loading status, preserving header/actions.
 * @param props.action - Caller-owned actions; disable when their required data is unavailable.
 * @param props.className - Use dashboard-card--short for shared short sizing; CSS tokens own heights.
 * @example <DashboardCard title="Notes" loading={hasTarget && query.isLoading} action={addNote}>{content}</DashboardCard>
 */
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
        {loading ? (
          <DashboardCardLoading label={loadingLabel} />
        ) : (
          children ?? <p className="dashboard-card__empty">{emptyMessage ?? 'No data available.'}</p>
        )}
      </div>
    </article>
  );
}

/**
 * Renders an accessible small spinner within a card's data or metric region.
 * Use this instead of whole-card loading when metric labels should remain visible.
 * @example <dd>{loading ? <DashboardCardLoading label="Loading hours…" /> : hours}</dd>
 */
export function DashboardCardLoading({ label = 'Loading dashboard data…' }: { label?: string }) {
  return (
    <div className="dashboard-card__loading" role="status" aria-label={label}>
      <LoadingSpinner size="sm" />
    </div>
  );
}

/**
 * Groups standalone dashboard cards in a named region outside PageContainer.
 * Pass cards directly to PageContainer's dashboard slot, which supplies its own layout.
 * @example <DashboardCardGroup ariaLabel="Overview"><DashboardCard title="Notes" /></DashboardCardGroup>
 */
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
