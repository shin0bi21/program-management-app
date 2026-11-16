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

it('routes edit and delete actions to the selected cycle', () => {
  const cycle = {
    id: 'cycle-1', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
  } as ProgramCycle;
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const { result } = renderHook(() => useCycleTable({ onEdit, onDelete }));

  const actionColumn = result.current.columns.find(column => column.id === 'actions') as ColumnDef<ProgramCycle>;
  const content = (actionColumn.cell as (context: CellContext<ProgramCycle, unknown>) => unknown)(
    { row: { original: cycle } } as CellContext<ProgramCycle, unknown>,
  );
  render(<>{content}</>);
  menu.items.find(item => item.id === 'edit')!.onClick();
  menu.items.find(item => item.id === 'delete')!.onClick();
  expect(onEdit).toHaveBeenCalledWith(cycle);
  expect(onDelete).toHaveBeenCalledWith(cycle);
});
