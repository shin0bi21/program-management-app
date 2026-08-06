import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  filters?: ReactNode;
  search?: ReactNode;
  view?: ReactNode;
}

export default function PageHeader({ title, actions, filters, search, view }: PageHeaderProps) {
  return (
    <header className={`page-header${filters || search || view ? ' page-header--with-controls' : ''}`}>
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        {actions}
      </div>
      {search && <div className="page-header-search">{search}</div>}
      {filters && <div className="page-header-filters">{filters}</div>}
      {view && <div className="page-header-view">{view}</div>}
    </header>
  );
}
