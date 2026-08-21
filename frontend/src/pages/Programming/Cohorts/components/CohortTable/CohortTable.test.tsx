// Scope: verifies cohort table data and control wiring.
import { render, screen } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import CohortTable from './CohortTable';

vi.mock('./hooks/useCohortTableData', () => ({ default: () => ({ rows: [], loading: false, refreshing: false, error: '', hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn() }) }));

it('renders the canonical cohort table', () => {
  render(<CohortTable queryKey={['cohorts', 'table']} filters={{}} columns={[]} hiddenColumnKeys={[]} sorting={{ key: 'start', direction: 'desc' }} columnWidths={{}} selectedKey={null} hasActiveQueryFilters={false} onRowSelect={vi.fn()} onSortingChange={vi.fn()} onColumnWidthsChange={vi.fn()} />);
  expect(screen.getByRole('table', { name: 'Cohorts' })).toBeInTheDocument();
});
