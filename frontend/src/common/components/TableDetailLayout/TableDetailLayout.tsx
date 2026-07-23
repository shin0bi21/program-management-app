import type { ReactNode } from 'react';
import './TableDetailLayout.css';

export default function TableDetailLayout({ table, details, ariaLabel }: {
  table: ReactNode;
  details: ReactNode;
  ariaLabel: string;
}) {
  return (
    <section className="table-detail-layout" aria-label={ariaLabel}>
      <div className="table-detail-layout__table">{table}</div>
      <aside className="table-detail-layout__details">{details}</aside>
    </section>
  );
}
