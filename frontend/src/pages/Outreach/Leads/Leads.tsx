import { useMemo, useState } from 'react';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import { useAuth } from '../../../common/context/AuthContext';
import { formatShortDate } from '../../../common/utils/date';
import { updateLeadStatus } from './api/leads.api';
import LeadModal from './components/LeadModal';
import { useLeads } from './hooks/useLeads';
import type { Lead, LeadStatus } from './types';
import './Leads.css';

const statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'signed_up', 'lost', 'ineligible'];
const title = (value: string) => value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');

export default function Leads() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');
  const { leads, setLeads, loading, error } = useLeads();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => leads.filter(lead => {
    const query = search.trim().toLowerCase();
    return (statusFilter === 'all' || lead.status === statusFilter) && (!query || `${lead.youthFirstName} ${lead.youthLastName} ${lead.school}`.toLowerCase().includes(query));
  }), [leads, search, statusFilter]);

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    const updated = await updateLeadStatus(lead.id, status);
    setLeads(current => current.map(item => item.id === updated.id ? updated : item));
  };

  const columns: TableColumn<Lead>[] = [
    { key: 'name', header: 'Youth', render: lead => `${lead.youthFirstName} ${lead.youthLastName}` },
    { key: 'school', header: 'School', render: lead => lead.school },
    { key: 'origin', header: 'Origin', width: '150px', render: lead => lead.origin === 'interest_submission' ? 'Public Interest' : 'Staff Created' },
    { key: 'status', header: 'Status', width: '120px', render: lead => <span className={`status-badge status-${lead.status}`}>{title(lead.status)}</span> },
    { key: 'created', header: 'Created', width: '130px', render: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{ key: 'actions' as const, header: '', className: 'col-actions', width: '32px', render: (lead: Lead) => <ActionsMenu items={statuses.filter(status => status !== lead.status).map(status => ({ id: status, label: `Mark ${title(status)}`, onClick: () => void setStatus(lead, status) }))} /> }] : []),
  ];

  return <section className="outreach-tab-content leads-panel" aria-label="Leads">
    <div className="leads-toolbar">
      <input aria-label="Search leads" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth or school" />
      <select aria-label="Filter leads by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as LeadStatus | 'all')}><option value="all">All statuses</option>{statuses.map(status => <option key={status} value={status}>{title(status)}</option>)}</select>
      {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Create Lead</Button>}
    </div>
    <Table columns={columns} data={filtered} loading={loading} error={error ?? undefined} emptyMessage={leads.length ? 'No leads match these filters' : 'No leads yet'} keyExtractor={lead => lead.id} maxHeight="calc(100vh - 260px)" />
    <LeadModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onSuccess={lead => { setLeads(current => [lead, ...current]); setCreateOpen(false); }} />
  </section>;
}
