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
  const hasControls = Boolean(view || filters || search || columns);

  return (
    <header className={`page-header${hasControls ? ' page-header--with-controls' : ''}`}>
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        {actions}
      </div>
      {hasControls && (
        <div className="page-header-controls">
          {columns && <div className="page-header-columns">{columns}</div>}
          {view && <div className="page-header-view">{view}</div>}
          {filters && <div className="page-header-filters">{filters}</div>}
          {search && <div className="page-header-search">{search}</div>}
        </div>
      )}
    </header>
  );
}
