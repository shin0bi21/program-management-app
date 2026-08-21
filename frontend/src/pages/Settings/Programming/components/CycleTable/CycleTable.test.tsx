// Scope: verifies cycle table rendering and selection wiring.
import { fireEvent, render, screen } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import CycleTable from './CycleTable';

it('renders and selects a cycle', () => {
  const cycle = { id: 'cycle-1', name: 'Summer', startsOn: '2026-07-01', endsOn: '2026-08-01', state: 'active' as const };
  const onRowSelect = vi.fn();
  render(<CycleTable columns={[{ id: 'name', header: 'Cycle', accessorFn: item => item.name }]} cycles={[cycle]} loading={false} selectedKey={null} onRowSelect={onRowSelect} />);
  fireEvent.click(screen.getByText('Summer'));
  expect(onRowSelect).toHaveBeenCalledWith(cycle);
});
