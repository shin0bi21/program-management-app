import { screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import { useLeads } from './hooks/useLeads';
import LeadTableView from './LeadTableView';

vi.mock('./hooks/useLeads', () => ({ useLeads: vi.fn() }));

it('owns the paginated lead table and filtered empty state', () => {
  vi.mocked(useLeads).mockReturnValue({
    leads: [], loading: false, refreshing: false, error: '',
    hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(),
  });
  renderWithQueryClient(<LeadTableView
    queryKey={['leads', 'list']}
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
  expect(useLeads).toHaveBeenCalledWith(
    ['leads', 'list'],
    { statuses: ['new'] },
    { key: 'created', direction: 'desc' },
  );
});
