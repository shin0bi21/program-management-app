import { useEffect, useMemo, useState } from 'react';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import { useAuth } from '../../../common/context/AuthContext';
import { formatShortDate } from '../../../common/utils/date';
import { updateLeadStatus } from './api/leads.api';
import LeadModal from './components/LeadModal';
import { useLeads } from './hooks/useLeads';
import type { Lead, LeadFilters, LeadStatus } from './types';
import './Leads.css';

const statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'signed_up', 'lost', 'ineligible'];
const title = (value: string) => value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');

export default function Leads() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<LeadStatus[]>([]);
  const queryFilters = useMemo<LeadFilters>(() => ({ search: debouncedSearch, statuses: statusFilters }), [debouncedSearch, statusFilters]);
  const { leads, loading, error, reload } = useLeads(queryFilters);
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [{
    id: 'status',
    label: 'Status',
    options: statuses.map(status => ({ value: status, label: title(status) })),
  }], []);

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    await updateLeadStatus(lead.id, status);
    await reload();
  };

  const columns: TableColumn<Lead>[] = [
    { key: 'name', header: 'Youth', render: lead => `${lead.youthFirstName} ${lead.youthLastName}` },
    { key: 'school', header: 'School', render: lead => lead.school },
    { key: 'origin', header: 'Origin', width: '150px', render: lead => lead.origin === 'expression_of_interest' ? 'Expression of Interest' : 'Staff Created' },
    { key: 'status', header: 'Status', width: '120px', render: lead => <span className={`status-badge status-${lead.status}`}>{title(lead.status)}</span> },
    { key: 'created', header: 'Created', width: '130px', render: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{
      key: 'actions' as const,
      header: '',
      className: 'col-actions',
      width: '32px',
      render: (lead: Lead) => <ActionsMenu items={[
        { id: 'edit', label: 'Edit', onClick: () => setModalTarget(lead) },
        ...statuses.filter(status => status !== lead.status).map(status => ({ id: status, label: `Mark ${title(status)}`, onClick: () => void setStatus(lead, status) })),
      ]} />,
    }] : []),
  ];

  return <>
    <PageHeader
      title="Outreach"
      actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Create Lead</Button> : undefined}
      search={<SearchInput label="Search leads" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth or school" />}
      filters={<FilterCard
        categories={filterCategories}
        values={{ status: statusFilters }}
        onApply={(_, selected) => setStatusFilters(selected as LeadStatus[])}
        onClearAll={() => setStatusFilters([])}
      />}
    />
    <section className="outreach-tab-content leads-panel" aria-label="Leads">
      <Table columns={columns} data={leads} loading={loading} error={error ?? undefined} emptyMessage={search || statusFilters.length ? 'No leads match these filters' : 'No leads yet'} keyExtractor={lead => lead.id} maxHeight="calc(100vh - 260px)" />
    </section>
    <LeadModal
      isOpen={modalTarget !== null}
      lead={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
      onClose={() => setModalTarget(null)}
      onSuccess={() => { setModalTarget(null); void reload(); }}
    />
  </>;
}
