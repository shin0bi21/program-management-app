import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { Session } from '../../../../../../common/features/programming/sessions/types';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import useSessionTable from './useSessionTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

function renderCell(column: ColumnDef<Session>, session: Session) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: session } } as CellContext<Session, unknown>);
}

describe('useSessionTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('omits management actions for read-only users', () => {
    const { result } = renderHook(() => useSessionTable({
      canWriteSessions: false,
      pendingSessionIds: [],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    expect(result.current.some(column => column.id === 'actions')).toBe(false);
  });


  it('provides Edit and Delete actions with the exact session callbacks', () => {
    const session = makeProgramSession();
    const callbacks = { onEdit: vi.fn(), onDelete: vi.fn() };
    const { result } = renderHook(() => useSessionTable({
      canWriteSessions: true,
      pendingSessionIds: [],
      ...callbacks,
    }));

    render(<>{renderCell(result.current.find(column => column.id === 'actions')!, session)}</>);

    menu.items.forEach(item => item.onClick());
    expect(callbacks.onEdit).toHaveBeenCalledWith(session);
    expect(callbacks.onDelete).toHaveBeenCalledWith(session);
  });
});
