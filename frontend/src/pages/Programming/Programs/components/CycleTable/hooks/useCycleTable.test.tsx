import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import useCycleTable from './useCycleTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

it('builds Cycle columns and emits edit and delete for the row', () => {
  const cycle = {
    id: 'cycle-1', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
  } as ProgramCycle;
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const { result } = renderHook(() => useCycleTable({ onEdit, onDelete }));
  expect(result.current.columns.map(column => column.id)).toEqual(['name', 'start', 'end', 'actions']);

  const actionColumn = result.current.columns.find(column => column.id === 'actions') as ColumnDef<ProgramCycle>;
  const content = (actionColumn.cell as (context: CellContext<ProgramCycle, unknown>) => unknown)(
    { row: { original: cycle } } as CellContext<ProgramCycle, unknown>,
  );
  render(<>{content}</>);
  expect(menu.items.map(item => [item.label, item.variant])).toEqual([
    ['Edit Cycle', undefined], ['Delete Cycle', 'danger'],
  ]);
  menu.items[0].onClick();
  menu.items[1].onClick();
  expect(onEdit).toHaveBeenCalledWith(cycle);
  expect(onDelete).toHaveBeenCalledWith(cycle);
});
