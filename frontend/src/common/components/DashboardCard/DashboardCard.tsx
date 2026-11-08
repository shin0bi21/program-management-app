import type { ReactNode } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './DashboardCard.css';

/**
 * Keeps a card's fixed-height shell and actions mounted while its data region changes.
 * Optional details use a compact label/value layout with an accessible-only title and a fixed action beside scrolling data.
 * @param props.children - Card content, or extra no-selection/error content below details. Without details, nullish uses emptyMessage or "No data available.".
 * @param props.details - Optional values with unique labels for compact summaries; nullish values display an em dash. Use dashboard-card--short for 75px summaries.
 * @param props.loading - Replaces data with loading status, preserving the header/actions or detail labels.
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
  details,
}: {
  title?: string;
  children?: ReactNode;
  emptyMessage?: string;
  className?: string;
  action?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  details?: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
  return (
    <article className={['dashboard-card', details && 'dashboard-card--details', className].filter(Boolean).join(' ')} aria-busy={loading}>
      {details ? <>
        {title && <h2 className="dashboard-card__accessible-title">{title}</h2>}
        <div className="dashboard-card__compact-layout">
          <div className="dashboard-card__content">
            <dl className="dashboard-card__details">
              {details.map(({ label, value }) => <div key={label}>
                <dt>{label}</dt>
                <dd>{loading ? <DashboardCardLoading label={`Loading ${label.toLowerCase()}…`} /> : value ?? '—'}</dd>
              </div>)}
            </dl>
            {!loading && children}
          </div>
          {action && <div className="dashboard-card__compact-action">{action}</div>}
        </div>
      </> : <>
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
      </>}
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
