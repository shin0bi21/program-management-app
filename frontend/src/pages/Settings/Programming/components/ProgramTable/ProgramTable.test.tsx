// Owns program table rendering and selection wiring.
import { fireEvent, render, screen } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import ProgramTable from './ProgramTable';

it('renders and selects a program', () => {
  const program = { id: 'program-1', name: 'Skills', description: '', rosterMode: 'open' as const, minAge: null, maxAge: null };
  const onRowSelect = vi.fn();
  render(<ProgramTable columns={[{ id: 'name', header: 'Program', accessorFn: item => item.name }]} programs={[program]} loading={false} selectedKey={null} onRowSelect={onRowSelect} />);
  fireEvent.click(screen.getByText('Skills'));
  expect(onRowSelect).toHaveBeenCalledWith(program);
});
