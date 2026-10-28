import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../common/components/ActionsMenu/ActionsMenu';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import type { YouthProfile } from '../../../types';
import useYouthTable from './useYouthTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

function renderCell(column: ColumnDef<YouthProfile>, profile: YouthProfile) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: profile } } as CellContext<YouthProfile, unknown>);
}

describe('useYouthTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('builds canonical data columns without actions for read-only users', () => {
    const { result } = renderHook(() => useYouthTable({
      canWrite: false, onEdit: vi.fn(), onAddNote: vi.fn(),
    }));

    expect(result.current.columns.map(column => column.id)).toEqual([
      'firstName', 'lastName', 'age', 'school', 'grade', 'program', 'status',
    ]);
  });

  it('maps writable row actions and emits the selected profile', () => {
    const profile = makeYouthProfile();
    const onEdit = vi.fn();
    const onAddNote = vi.fn();
    const { result } = renderHook(() => useYouthTable({ canWrite: true, onEdit, onAddNote }));
    const actionColumn = result.current.columns.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionColumn, profile)}</>);
    expect(menu.items.map(item => item.id)).toEqual(['edit', 'add-note']);
    menu.items[0].onClick();
    menu.items[1].onClick();
    expect(onEdit).toHaveBeenCalledWith(profile);
    expect(onAddNote).toHaveBeenCalledWith(profile);
  });

  it('displays the authoritative age instead of recalculating the birth date', () => {
    const { result } = renderHook(() => useYouthTable({ canWrite: false, onEdit: vi.fn(), onAddNote: vi.fn() }));
    const ageColumn = result.current.columns.find(column => column.id === 'age')!;
    if (!('accessorFn' in ageColumn)) throw new Error('Age column requires an accessor');

    expect(ageColumn.accessorFn?.(makeYouthProfile({ dateOfBirth: '2000-01-01', age: 14 }), 0)).toBe(14);
    expect(ageColumn.accessorFn?.(makeYouthProfile({ age: null }), 0)).toBe('—');
  });
});
