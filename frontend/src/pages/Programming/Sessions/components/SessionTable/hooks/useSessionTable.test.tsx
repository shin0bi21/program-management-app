// Owns Session table columns, permission-aware actions, and exact callbacks.
import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { CohortSession } from '../../../../../../common/types/cohort';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import useSessionTable from './useSessionTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

function renderCell(column: ColumnDef<CohortSession>, session: CohortSession) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: session } } as CellContext<CohortSession, unknown>);
}

describe('useSessionTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('provides canonical data columns without actions for read-only users', () => {
    const { result } = renderHook(() => useSessionTable({
      canWriteAttendance: false,
      canWriteSessions: false,
      onTakeAttendance: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    expect(result.current.map(column => column.id)).toEqual([
      'program', 'cohort', 'theme', 'date', 'time', 'type', 'status',
    ]);
  });

  it.each([
    [true, false, ['attendance']],
    [false, true, ['edit', 'delete']],
    [true, true, ['attendance', 'edit', 'delete']],
  ])('maps attendance=%s and session=%s permissions', (canWriteAttendance, canWriteSessions, ids) => {
    const { result } = renderHook(() => useSessionTable({
      canWriteAttendance,
      canWriteSessions,
      onTakeAttendance: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));
    const actionColumn = result.current.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionColumn, makeCohortSession())}</>);
    expect(menu.items.map(item => item.id)).toEqual(ids);
  });

  it('emits exact attendance, edit, and delete callbacks', () => {
    const session = makeCohortSession();
    const callbacks = { onTakeAttendance: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
    const { result } = renderHook(() => useSessionTable({
      canWriteAttendance: true,
      canWriteSessions: true,
      ...callbacks,
    }));

    render(<>{renderCell(result.current.find(column => column.id === 'actions')!, session)}</>);
    menu.items.forEach(item => item.onClick());
    expect(callbacks.onTakeAttendance).toHaveBeenCalledWith(session);
    expect(callbacks.onEdit).toHaveBeenCalledWith(session);
    expect(callbacks.onDelete).toHaveBeenCalledWith(session);
    expect(menu.items.find(item => item.id === 'delete')).toMatchObject({ variant: 'danger' });
  });
});
