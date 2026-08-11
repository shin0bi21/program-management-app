import { useEffect, useMemo, useState } from 'react';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import Modal from '../../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import PageBody from '../../../common/components/PageBody/PageBody';
import PrimaryContactCard from '../../../common/features/contacts/components/PrimaryContactCard/PrimaryContactCard';
import NotesCard from '../common/components/NotesCard/NotesCard';
import { useAuth } from '../../../auth/authContext';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import { formatShortDate } from '../../../common/utils/date';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import useUserPreference from '../../../common/features/preferences/hooks/useUserPreference';
import { updateLeadStatus } from './api/leads.api';
import LeadModal from './components/LeadModal';
import LeadNotesCard from './components/LeadNotesCard/LeadNotesCard';
import SignUpLeadModal from './components/SignUpLeadModal';
import { useLeads } from './hooks/useLeads';
import type { Lead, LeadFilters, LeadSortKey, LeadStatus } from './types';
import type { ListSort } from '../../../common/types/pagination';
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
  const [filtersReady, setFiltersReady] = useState(false);
  const [sorting, setSorting] = useState<ListSort<LeadSortKey>>({ key: 'createdAt', direction: 'desc' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const queryFilters = useMemo<LeadFilters | null>(() => filtersReady
    ? ({ search: debouncedSearch, statuses: statusFilters, programIds: programFilters })
    : null, [debouncedSearch, filtersReady, statusFilters, programFilters]);
  const { leads, loading, refreshing, error, reload, hasNextPage, loadingNextPage, loadNextPage } = useLeads(queryFilters, sorting);
  const { programs, loading: programsLoading } = usePrograms();
  const { preference, loading: preferenceLoading, error: preferenceError, save } = useUserPreference('lead-filters');
  const [modalTarget, setModalTarget] = useState<Lead | 'new' | null>(null);
  const {
    selectedItem: selectedLead,
    selectedKey: selectedLeadId,
    selectItem: selectLead,
  } = useTableSelection(leads);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [signUpTarget, setSignUpTarget] = useState<Lead | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (filtersReady || preferenceLoading || programsLoading) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    setStatusFilters(preference?.statuses ?? []);
    setProgramFilters(preference?.programIds.filter(id => availableProgramIds.has(id)) ?? []);
    setSorting(preference?.sorting ?? { key: 'createdAt', direction: 'desc' });
    setColumnWidths(preference?.columnWidths ?? {});
    setFiltersReady(true);
  }, [filtersReady, preference, preferenceLoading, programs, programsLoading]);

  const persistFilters = (nextStatuses: LeadStatus[], nextProgramIds: string[]) => {
    void save({ statuses: nextStatuses, programIds: nextProgramIds, sorting, columnWidths });
  };

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'status',
      label: 'Status',
      options: statuses.map(status => ({ value: status, label: title(status) })),
    },
  ], [programs]);

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    await updateLeadStatus(lead.id, status);
    await reload();
  };

  const requestSignUp = (lead: Lead) => setSignUpTarget(lead);

  const columns: TableColumn<Lead>[] = [
    { key: 'firstName', sortKey: 'name', header: 'First Name', render: lead => lead.youthFirstName },
    { key: 'lastName', header: 'Last Name', render: lead => lead.youthLastName },
    { key: 'school', sortKey: 'school', header: 'School', render: lead => lead.school },
    { key: 'program', sortKey: 'program', header: 'Program of Interest', render: lead => lead.programOfInterestName ?? '—' },
    { key: 'status', sortKey: 'status', header: 'Status', width: 120, render: lead => <span className={`status-badge status-${lead.status}`}>{title(lead.status)}</span> },
    { key: 'created', sortKey: 'createdAt', header: 'Created', width: 130, render: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{
      key: 'actions' as const,
      width: 40,
      resizable: false,
      header: '',
      className: 'col-actions',
      render: (lead: Lead) => lead.status === 'signed_up'
        ? null
        : <ActionsMenu
          ariaLabel={`More actions for ${lead.youthFirstName} ${lead.youthLastName}`}
          items={[
            { id: 'edit', label: 'Edit', onClick: () => setModalTarget(lead) },
            { id: 'sign-up', label: 'Sign Up', onClick: () => requestSignUp(lead) },
            ...editableStatuses.filter(status => status !== lead.status).map(status => ({ id: status, label: `Mark ${title(status)}`, onClick: () => void setStatus(lead, status) })),
          ]}
        />,
    }] : []),
  ];

  return <>
    <PageHeader
      title="Leads"
      actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
      search={<SearchInput label="Search leads" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search youth or school" />}
      filters={<FilterCard
        categories={filterCategories}
        values={{ status: statusFilters, program: programFilters }}
        onApply={(category, selected) => {
          if (category === 'status') {
            const next = selected as LeadStatus[];
            setStatusFilters(next);
            persistFilters(next, programFilters);
          }
          if (category === 'program') {
            setProgramFilters(selected);
            persistFilters(statusFilters, selected);
          }
        }}
        onClearAll={() => { setStatusFilters([]); setProgramFilters([]); persistFilters([], []); }}
      />}
    />
    {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}
    <PageBody
      ariaLabel="Leads"
      table={<Table ariaLabel="Leads" columns={columns} data={leads} loading={loading} refreshing={refreshing} error={error ?? undefined} emptyMessage={search || statusFilters.length || programFilters.length ? 'No leads match these filters' : 'No leads yet'} keyExtractor={lead => lead.id} selectedKey={selectedLeadId} onRowSelect={selectLead} sorting={sorting} onSortingChange={next => { const value = next as ListSort<LeadSortKey>; setSorting(value); void save({ statuses: statusFilters, programIds: programFilters, sorting: value, columnWidths }); }} columnWidths={columnWidths} onColumnWidthsChange={next => { setColumnWidths(next); void save({ statuses: statusFilters, programIds: programFilters, sorting, columnWidths: next }); }} hasNextPage={hasNextPage} loadingNextPage={loadingNextPage} onLoadNextPage={loadNextPage} />}
      dashboard={<>
        <PrimaryContactCard contact={selectedLead ? {
          phoneNumber: selectedLead.contactPhoneNumber,
          relationship: selectedLead.contactRelationship,
        } : null} selected={selectedLead !== null} />
        <NotesCard notes={selectedLead?.notes} selected={selectedLead !== null} />
        <LeadNotesCard lead={selectedLead} canWrite={canWrite} />
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
      successDelay={confirmModal.successDelay}
    >
      {confirmAction && <p>{confirmAction.message}</p>}
    </Modal>
  </>;
}
