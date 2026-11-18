import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { Program } from '../../../types';
import useProgramTable from './useProgramTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

it('routes program management actions to the selected row', () => {
  const program = {
    id: 'program-1', title: 'Soft Skills', description: null, enrollmentRequired: true, minAge: 12, maxAge: 15, defaultDayOfWeek: 'tuesday' as const, defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
  } as Program;
  const onEdit = vi.fn();
  const onManageCycles = vi.fn();
  const { result } = renderHook(() => useProgramTable(onEdit, onManageCycles, true, { assignments: [], loading: false, error: null }));

  const actionColumn = result.current.columns.find(column => column.id === 'actions') as ColumnDef<Program>;
  const content = (actionColumn.cell as (context: CellContext<Program, unknown>) => unknown)(
    { row: { original: program } } as CellContext<Program, unknown>,
  );
  render(<>{content}</>);
  menu.items.find(item => item.id === 'edit')!.onClick();
  expect(onEdit).toHaveBeenCalledWith(program);
  menu.items.find(item => item.id === 'cycles')!.onClick();
  expect(onManageCycles).toHaveBeenCalledWith(program);
});

it('omits program management actions for read-only viewers', () => {
  const { result } = renderHook(() => useProgramTable(vi.fn(), vi.fn(), false, { assignments: [], loading: false, error: null }));

  expect(result.current.columns.some(column => column.id === 'actions')).toBe(false);
});

it.each([
  { states: ['active', 'completed'] as const, loading: false, error: null, expected: 'Active' },
  { states: ['upcoming', 'completed'] as const, loading: false, error: null, expected: 'Inactive' },
  { states: [] as const, loading: false, error: null, expected: 'Inactive' },
  { states: [] as const, loading: true, error: null, expected: 'Loading…' },
  { states: ['active'] as const, loading: false, error: 'Failed', expected: 'Unavailable' },
])('shows $expected from assigned cycle state without treating unknown data as inactive', ({ states, loading, error, expected }) => {
  const assignments = [
    ...states.map(state => ({ programId: 'program-1', state })),
    { programId: 'another-program', state: 'active' as const },
  ];
  const { result } = renderHook(() => useProgramTable(vi.fn(), vi.fn(), false, { assignments, loading, error }));
  const statusColumn = result.current.columns.find(column => column.id === 'status');

  expect(statusColumn && 'accessorFn' in statusColumn && statusColumn.accessorFn?.({ id: 'program-1' } as Program, 0))
    .toBe(expected);
});
