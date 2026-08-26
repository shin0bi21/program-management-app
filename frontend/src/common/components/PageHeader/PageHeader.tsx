import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  filters?: ReactNode;
  search?: ReactNode;
  view?: ReactNode;
  columns?: ReactNode;
}

export default function PageHeader({ title, actions, filters, search, view, columns }: PageHeaderProps) {
  const hasViewControls = Boolean(columns || view);
  const hasDataControls = Boolean(search || filters);

  return (
    <header className={`page-header${filters || search || view || columns ? ' page-header--with-controls' : ''}`}>
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        {actions}
      </div>
      {(hasViewControls || hasDataControls) && (
        <div className="page-header-controls">
          {hasViewControls && (
            <div className="page-header-view-controls">
              {columns && <div className="page-header-columns">{columns}</div>}
              {view && <div className="page-header-view">{view}</div>}
            </div>
          )}
          {hasDataControls && (
            <div className="page-header-data-controls">
              {search && <div className="page-header-search">{search}</div>}
              {filters && <div className="page-header-filters">{filters}</div>}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
