import { useEffect, useMemo, useState } from 'react';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import Modal from '../../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import TableDetailLayout from '../../../common/components/TableDetailLayout/TableDetailLayout';
import { NotesCard, PrimaryContactCard } from '../../../common/components/DetailCards/DetailCards';
import { useAuth } from '../../../common/context/AuthContext';
import { useConfirmModal, type ConfirmAction } from '../../../common/hooks/useConfirmModal';
import { formatShortDate } from '../../../common/utils/date';
import { usePrograms } from '../../../common/hooks/usePrograms';
import { updateLeadStatus } from './api/leads.api';
import LeadModal from './components/LeadModal';
import SignUpLeadModal from './components/SignUpLeadModal';
import { useLeads } from './hooks/useLeads';
import type { Lead, LeadFilters, LeadStatus } from './types';
import './Leads.css';

const statuses: LeadStatus[] = ['new', 'contacted', 'eligible', 'ineligible', 'signed_up'];
const editableStatuses: LeadStatus[] = ['new', 'contacted', 'eligible', 'ineligible'];
const title = (value: string) => value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');

export default function Leads() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:outreach');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<LeadStatus[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const queryFilters = useMemo<LeadFilters>(() => ({ search: debouncedSearch, statuses: statusFilters, programIds: programFilters }), [debouncedSearch, statusFilters, programFilters]);
  const { leads, loading, error, reload } = useLeads(queryFilters);
  const { programs } = usePrograms();
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [signUpTarget, setSignUpTarget] = useState<Lead | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setSelectedLead(current => current
      ? leads.find(lead => lead.id === current.id) ?? null
      : null);
  }, [leads]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'status',
      label: 'Status',
      options: statuses.map(status => ({ value: status, label: title(status) })),
    },
    {
      id: 'program',
      label: 'Program',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
  ], [programs]);

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    await updateLeadStatus(lead.id, status);
    await reload();
  };

  const requestSignUp = (lead: Lead) => setSignUpTarget(lead);

  const columns: TableColumn<Lead>[] = [
    { key: 'name', header: 'Youth', render: lead => `${lead.youthFirstName} ${lead.youthLastName}` },
    { key: 'school', header: 'School', render: lead => lead.school },
    { key: 'program', header: 'Program of Interest', render: lead => lead.programOfInterestName ?? '—' },
    { key: 'status', header: 'Status', width: '120px', render: lead => <span className={`status-badge status-${lead.status}`}>{title(lead.status)}</span> },
    { key: 'created', header: 'Created', width: '130px', render: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{
      key: 'actions' as const,
      header: '',
      className: 'col-actions',
      width: '32px',
      render: (lead: Lead) => <ActionsMenu
        ariaLabel={`More actions for ${lead.youthFirstName} ${lead.youthLastName}`}
        items={[
          { id: 'edit', label: 'Edit', onClick: () => setModalTarget(lead) },
          ...(lead.status !== 'signed_up' ? [
            { id: 'sign-up', label: 'Sign Up', onClick: () => requestSignUp(lead) },
            ...editableStatuses.filter(status => status !== lead.status).map(status => ({ id: status, label: `Mark ${title(status)}`, onClick: () => void setStatus(lead, status) })),
          ] : []),
        ]}
      />,
    }] : []),
  ];

  return <>
    <PageHeader
      title="Outreach"
      actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Create Lead</Button> : undefined}
      search={<SearchInput label="Search leads" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth or school" />}
      filters={<FilterCard
        categories={filterCategories}
        values={{ status: statusFilters, program: programFilters }}
        onApply={(category, selected) => {
          if (category === 'status') setStatusFilters(selected as LeadStatus[]);
          if (category === 'program') setProgramFilters(selected);
        }}
        onClearAll={() => { setStatusFilters([]); setProgramFilters([]); }}
      />}
    />
    <TableDetailLayout
      ariaLabel="Leads"
      table={<Table columns={columns} data={leads} loading={loading} error={error ?? undefined} emptyMessage={search || statusFilters.length || programFilters.length ? 'No leads match these filters' : 'No leads yet'} keyExtractor={lead => lead.id} maxHeight="calc(100vh - 260px)" selectedKey={selectedLead?.id} onRowSelect={setSelectedLead} />}
      details={<>
        <PrimaryContactCard contact={selectedLead ? {
          firstName: selectedLead.contactFirstName,
          lastName: selectedLead.contactLastName,
          phoneNumber: selectedLead.contactPhoneNumber,
          relationship: selectedLead.contactRelationship,
        } : null} />
        <NotesCard notes={selectedLead?.notes} selected={selectedLead !== null} />
      </>}
    />
    <LeadModal
      isOpen={modalTarget !== null}
      lead={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
      onClose={() => setModalTarget(null)}
      onSuccess={() => { setModalTarget(null); void reload(); }}
    />
    <SignUpLeadModal
      lead={signUpTarget}
      onClose={() => setSignUpTarget(null)}
      onSuccess={reload}
    />
    <Modal
      isOpen={!!confirmAction}
      onClose={() => setConfirmAction(null)}
      title={confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      disableClose={confirmModal.disableClose}
      successDelay={confirmModal.successDelay}
    >
      {confirmAction && <p>{confirmAction.message}</p>}
    </Modal>
  </>;
}
