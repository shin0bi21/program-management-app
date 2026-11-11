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

/**
 * Renders a column's cell for the supplied youth profile.
 * @param column - Column with a cell renderer; throws if the renderer is missing.
 * @param profile - Youth profile to supply as the row's original record.
 * @example renderCell(actionsColumn, profile) // renders the profile's action menu
 */
function renderCell(column: ColumnDef<YouthProfile>, profile: YouthProfile) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: profile } } as CellContext<YouthProfile, unknown>);
}

describe('useYouthTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('omits management actions for read-only users', () => {
    const { result } = renderHook(() => useYouthTable({
      canWrite: false, onEdit: vi.fn(), onAddNote: vi.fn(),
    }));

    expect(result.current.columns.some(column => column.id === 'actions')).toBe(false);
  });


  it('emits the profile for editing and the youth ID for adding a note', () => {
    const profile = makeYouthProfile();
    const onEdit = vi.fn();
    const onAddNote = vi.fn();
    const { result } = renderHook(() => useYouthTable({ canWrite: true, onEdit, onAddNote }));
    const actionColumn = result.current.columns.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionColumn, profile)}</>);
    menu.items.find(item => item.id === 'edit')!.onClick();
    menu.items.find(item => item.id === 'add-note')!.onClick();
    expect(onEdit).toHaveBeenCalledWith(profile);
    expect(onAddNote).toHaveBeenCalledWith(profile.id);
  });
});
