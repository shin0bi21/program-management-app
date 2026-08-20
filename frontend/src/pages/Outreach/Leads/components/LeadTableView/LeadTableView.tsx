import Table, { type TableColumn } from '../../../../../common/components/Table/Table';
import type { ListSort } from '../../../../../common/types/pagination';
import type { Lead, LeadFilters, LeadSortKey } from '../../types';
import { useLeads } from './hooks/useLeads';

interface LeadTableViewProps {
  queryKey: readonly unknown[];
  columns: TableColumn<Lead>[];
  hiddenColumnKeys: string[];
  filters: LeadFilters | null;
  sorting: ListSort<LeadSortKey>;
  columnWidths: Record<string, number>;
  selectedLeadId: string | null;
  onLeadSelect: (lead: Lead) => void;
  onSortingChange: (sorting: ListSort<LeadSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function LeadTableView({
  queryKey, columns, hiddenColumnKeys, filters, sorting, columnWidths,
  selectedLeadId, onLeadSelect, onSortingChange, onColumnWidthsChange,
}: LeadTableViewProps) {
  const query = useLeads(queryKey, filters, sorting);
  const hasFilters = Boolean(filters && (
    filters.search?.trim()
    || filters.statuses?.length
    || filters.programIds?.length
    || filters.origins?.length
  ));

  return <Table
    ariaLabel="Leads"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.leads}
    loading={query.loading}
    refreshing={query.refreshing}
    error={query.error || undefined}
    emptyMessage={hasFilters ? 'No leads match these filters' : 'No leads yet'}
    keyExtractor={lead => lead.id}
    selectedKey={selectedLeadId ?? undefined}
    onRowSelect={onLeadSelect}
    sorting={sorting}
    onSortingChange={next => onSortingChange(next as ListSort<LeadSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    onLoadNextPage={query.loadNextPage}
  />;
}
