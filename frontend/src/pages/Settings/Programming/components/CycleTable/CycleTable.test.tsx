import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import CycleTable from './CycleTable';

it('renders cycles', () => {
  const cycle = { id: 'cycle-1', name: 'Summer', startsOn: '2026-07-01', endsOn: '2026-08-01', state: 'active' as const };

  render(<CycleTable
    columns={[{ id: 'name', header: 'Cycle', accessorFn: item => item.name }]}
    cycles={[cycle]}
    loading={false}
  />);

  expect(screen.getByText('Summer')).toBeInTheDocument();
});
