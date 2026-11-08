import { expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../../../../tests/queryClientTestUtils';
import { useLeadTableData } from './hooks/useLeadTableData';
import LeadTable from './LeadTable';

vi.mock('./hooks/useLeadTableData', () => ({ useLeadTableData: vi.fn() }));
const tableMessage = vi.hoisted(() => ({ current: undefined as string | undefined }));
vi.mock('../../../../common/components/Table/Table', () => ({
  default: ({ emptyMessage }: { emptyMessage?: string }) => {
    tableMessage.current = emptyMessage;
    return null;
  },
}));

it('selects the empty message from the applied lead filters', () => {
  vi.mocked(useLeadTableData).mockReturnValue({
    leads: [], loading: false, refreshing: false, error: '',
    hasNextPage: false, loadingNextPage: false, nextPageError: '', retryNextPage: vi.fn(), loadNextPage: vi.fn(), retry: vi.fn(),
  });
  renderWithQueryClient(<LeadTable
    queryKey={['leads', 'table']}
    columns={[]}
    hiddenColumnKeys={[]}
    filters={{ statuses: ['new'] }}
    sorting={{ key: 'created', direction: 'desc' }}
    columnWidths={{}}
    selectedLeadId={null}
    onLeadSelect={vi.fn()}
    onSortingChange={vi.fn()}
    onColumnWidthsChange={vi.fn()}
  />);
  expect(tableMessage.current).toBe('No leads match these filters');
});
