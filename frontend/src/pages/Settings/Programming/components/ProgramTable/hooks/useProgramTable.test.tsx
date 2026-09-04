import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { Program } from '../../../../../../common/features/programs/types';
import useProgramTable from './useProgramTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

it('builds Program columns and emits edit for the row', () => {
  const program = {
    id: 'program-1', name: 'Soft Skills', description: null, rosterMode: 'enrolled', minAge: 12, maxAge: 15,
  } as Program;
  const onEdit = vi.fn();
  const { result } = renderHook(() => useProgramTable(onEdit));
  expect(result.current.columns.map(column => column.id)).toEqual(['name', 'attendance', 'ages', 'actions']);

  const actionColumn = result.current.columns.find(column => column.id === 'actions') as ColumnDef<Program>;
  const content = (actionColumn.cell as (context: CellContext<Program, unknown>) => unknown)(
    { row: { original: program } } as CellContext<Program, unknown>,
  );
  render(<>{content}</>);
  expect(menu.items.map(item => item.label)).toEqual(['Edit Program']);
  menu.items[0].onClick();
  expect(onEdit).toHaveBeenCalledWith(program);
});
