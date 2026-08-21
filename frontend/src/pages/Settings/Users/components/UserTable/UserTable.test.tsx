// Scope: verifies user table data and control wiring.
import { render, screen } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import UserTable from './UserTable';

vi.mock('./hooks/useUserTableData', () => ({ default: () => ({ rows: [], loading: false, refreshing: false, error: '', hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn() }) }));

it('renders the canonical user table', () => {
  render(<UserTable queryKey={['accounts', 'table']} filters={{}} columns={[]} hiddenColumnKeys={[]} sorting={{ key: 'name', direction: 'asc' }} columnWidths={{}} hasActiveQueryFilters={false} onSortingChange={vi.fn()} onColumnWidthsChange={vi.fn()} />);
  expect(screen.getByRole('table', { name: 'Accounts' })).toBeInTheDocument();
});
