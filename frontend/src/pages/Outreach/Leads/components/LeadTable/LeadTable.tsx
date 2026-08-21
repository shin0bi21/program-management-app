import Table from '../../../../../common/components/Table/Table';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { ListSort } from '../../../../../common/types/pagination';
import { LEAD_TABLE_KEYS, type Lead, type LeadFilters, type LeadSortKey } from '../../types';
import { useLeadTableData } from './hooks/useLeadTableData';

interface LeadTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<Lead>[];
  hiddenColumnKeys: string[];
  filters: LeadFilters | null;
  sorting: ListSort<LeadSortKey>;
  columnWidths: Record<string, number>;
  selectedLeadId: string | null;
  onLeadSelect: (lead: Lead) => void;
  onSortingChange: (sorting: ListSort<LeadSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function LeadTable({
  queryKey, columns, hiddenColumnKeys, filters, sorting, columnWidths,
  selectedLeadId, onLeadSelect, onSortingChange, onColumnWidthsChange,
}: LeadTableProps) {
  const query = useLeadTableData(queryKey, filters, sorting);
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
    sortableColumns={LEAD_TABLE_KEYS}
    onSortingChange={next => onSortingChange(next as ListSort<LeadSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    onLoadNextPage={query.loadNextPage}
  />;
}
