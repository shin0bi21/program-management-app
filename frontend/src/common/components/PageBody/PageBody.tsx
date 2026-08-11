import type { ReactNode } from 'react';
import './PageBody.css';

type PageBodyContent =
  | { table: ReactNode; calendar?: never }
  | { table?: never; calendar: ReactNode };

type PageBodyProps = PageBodyContent & {
  dashboard: ReactNode;
  ariaLabel: string;
};

export default function PageBody({ dashboard, table, calendar, ariaLabel }: PageBodyProps) {
  const content = table === undefined ? calendar : table;
  const contentClassName = table === undefined ? 'page-calendar' : 'page-table';

  return (
    <section className="page-body" aria-label={ariaLabel}>
      <aside className="page-dashboard">{dashboard}</aside>
      <div className={contentClassName}>{content}</div>
    </section>
  );
}
