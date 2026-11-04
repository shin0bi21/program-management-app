import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { ProgramSession } from '../../../types';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import useSessionTable from './useSessionTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

function renderCell(column: ColumnDef<ProgramSession>, session: ProgramSession) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: session } } as CellContext<ProgramSession, unknown>);
}

describe('useSessionTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('omits management actions for read-only users', () => {
    const { result } = renderHook(() => useSessionTable({
      canWriteSessions: false,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    expect(result.current.some(column => column.id === 'actions')).toBe(false);
  });

  it('formats dates and hours in the program timezone', () => {
    const { result } = renderHook(() => useSessionTable({
      programs: [{ id: 'program-1', name: 'Art', enrollmentRequired: false, minAge: null, maxAge: null,
        defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' }],
      canWriteSessions: false,
      onEdit: vi.fn(), onDelete: vi.fn(),
    }));
    const session = makeProgramSession({ startsAt: '2026-08-10T02:00:00Z', endsAt: '2026-08-10T03:00:00Z' });
    const dateColumn = result.current.find(column => column.id === 'date')!;
    const timeColumn = result.current.find(column => column.id === 'time')!;
    if (!('accessorFn' in dateColumn) || !('accessorFn' in timeColumn)) throw new Error('Missing accessors');
    expect(dateColumn.accessorFn!(session, 0)).toBe('Aug 9, 2026');
    expect(timeColumn.accessorFn!(session, 0)).toMatch(/10:00.*11:00/);
  });

  it('provides Edit and Delete actions with the exact session callbacks', () => {
    const session = makeProgramSession();
    const callbacks = { onEdit: vi.fn(), onDelete: vi.fn() };
    const { result } = renderHook(() => useSessionTable({
      canWriteSessions: true,
      ...callbacks,
    }));

    render(<>{renderCell(result.current.find(column => column.id === 'actions')!, session)}</>);

    menu.items.forEach(item => item.onClick());
    expect(callbacks.onEdit).toHaveBeenCalledWith(session);
    expect(callbacks.onDelete).toHaveBeenCalledWith(session);
  });
});
