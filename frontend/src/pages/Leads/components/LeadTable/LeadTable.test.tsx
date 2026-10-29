import { screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../../../../tests/queryClientTestUtils';
import { useLeadTableData } from './hooks/useLeadTableData';
import LeadTable from './LeadTable';

vi.mock('./hooks/useLeadTableData', () => ({ useLeadTableData: vi.fn() }));

it('owns the paginated lead table and filtered empty state', () => {
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
  expect(screen.getByText('No leads match these filters')).toBeInTheDocument();
  expect(useLeadTableData).toHaveBeenCalledWith(
    ['leads', 'table'],
    { statuses: ['new'] },
    { key: 'created', direction: 'desc' },
  );
});
