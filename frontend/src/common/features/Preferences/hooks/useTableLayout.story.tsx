import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import Table from '../../../components/Table/Table';
import type { TableColumnDef } from '../../../components/Table/Table.types';
import useTableLayout from './useTableLayout';

interface LayoutRow {
  id: string;
  name: string;
  status: string;
  notes: string;
}

const columns: TableColumnDef<LayoutRow>[] = [
  { id: 'name', header: 'Name', size: 300, cell: ({ row }) => row.original.name },
  { id: 'status', header: 'Status', size: 220, cell: ({ row }) => row.original.status },
  { id: 'notes', header: 'Notes', size: 280, cell: ({ row }) => row.original.notes },
];
const rows: LayoutRow[] = [{ id: '1', name: 'Taylor', status: 'Active', notes: 'Follow up next week' }];

function LocalLayoutTable() {
  const layout = useTableLayout({ key: 'task-preferences', tableKeys: ['name', 'status', 'notes'] });

  return <div style={{ padding: 16, maxWidth: 900 }}>
    <button onClick={() => layout.setHiddenColumns(layout.hiddenColumns.includes('status') ? [] : ['status'])}>
      Toggle status column
    </button>
    <Table ariaLabel="Device layout table" columns={columns} data={rows} keyExtractor={row => row.id}
      hiddenColumnKeys={layout.hiddenColumns} columnWidths={layout.columnWidths}
      enableColumnResizing onColumnWidthsChange={layout.setColumnWidths} />
  </div>;
}

export function DeviceLocalLayout() {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><LocalLayoutTable /></QueryClientProvider>;
}
