import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { User } from '../../../types';
import useUserTable from './useUserTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));

vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div data-testid="account-actions" />;
  },
}));

const account: User = {
  id: 'account-1', firstName: 'Alice', lastName: 'Admin', email: 'alice@example.com',
  role: 'admin', status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
};

function renderCell(column: ColumnDef<User>, value: User) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: value } } as CellContext<User, unknown>);
}

describe('useUserTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('returns canonical account columns without actions for read-only users', () => {
    const { result } = renderHook(() => useUserTable({
      canWrite: false, isAdmin: true, onEdit: vi.fn(), onRevoke: vi.fn(), onToggleStatus: vi.fn(),
    }));

    expect(result.current.columns.map(column => column.id)).toEqual([
      'name', 'email', 'role', 'status', 'createdAt',
    ]);
  });

  it.each([
    ['active administrator', account, true, ['edit', 'deactivate']],
    ['active project manager', { ...account, role: 'project_manager' as const }, true, ['edit', 'deactivate']],
    ['invited staff member', { ...account, role: 'staff' as const, status: 'invited' as const }, true, ['edit', 'revoke']],
    ['inactive youth', { ...account, role: 'youth' as const, status: 'inactive' as const }, true, ['activate']],
    ['active staff for a non-admin viewer', { ...account, role: 'staff' as const }, false, ['deactivate']],
  ])('maps actions for an %s', (_scenario, value, isAdmin, ids) => {
    const callbacks = { onEdit: vi.fn(), onRevoke: vi.fn(), onToggleStatus: vi.fn() };
    const { result } = renderHook(() => useUserTable({ canWrite: true, isAdmin, ...callbacks }));
    const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionsColumn, value)}</>);
    expect(menu.items.map(item => item.id)).toEqual(ids);
  });

  it('emits exact edit, revoke, and status-toggle callbacks', () => {
    const callbacks = { onEdit: vi.fn(), onRevoke: vi.fn(), onToggleStatus: vi.fn() };
    const { result } = renderHook(() => useUserTable({ canWrite: true, isAdmin: true, ...callbacks }));
    const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionsColumn, account)}</>);
    menu.items.find(item => item.id === 'edit')!.onClick();
    menu.items.find(item => item.id === 'deactivate')!.onClick();
    expect(callbacks.onEdit).toHaveBeenCalledWith(account);
    expect(callbacks.onToggleStatus).toHaveBeenCalledWith(account);

    const invited = { ...account, status: 'invited' as const };
    render(<>{renderCell(result.current.columns.find(column => column.id === 'actions')!, invited)}</>);
    menu.items.find(item => item.id === 'revoke')!.onClick();
    expect(callbacks.onRevoke).toHaveBeenCalledWith(invited);
  });
});
