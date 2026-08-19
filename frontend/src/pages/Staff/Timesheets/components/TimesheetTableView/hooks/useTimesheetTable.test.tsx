// Scope: verifies timesheet columns, writable row actions, and isolated table preference patches.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeTimesheetItem } from '../../../../../../tests/factories/timesheet';
import type { TimesheetListRow, TimesheetPreferences } from '../../../types';
import useTimesheetTable from './useTimesheetTable';

const preferences: TimesheetPreferences = {
  view: 'list', staffIds: [], programIds: [], categories: [], types: [], cycleId: null,
  sorting: { key: 'date', direction: 'desc' }, columnWidths: {}, hiddenColumns: [],
};
const writable = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const row: TimesheetListRow = {
  id: 'entry-1', resourceId: 'staff-1', date: '2026-08-19',
  staffFirstName: 'Zoe', staffLastName: 'Wilson', staffName: 'Zoe Wilson',
  item: makeTimesheetItem({ id: 'entry-1', taskId: 'task-1', taskTitle: 'Prepare workshop' }),
};

describe('useTimesheetTable', () => {
  it('builds row actions only for writable resources', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() => useTimesheetTable({
      canWrite: true,
      resourcesById: new Map([[writable.id, writable]]),
      preferences,
      updatePreferences: vi.fn(),
      isEntryPending: () => false,
      onEdit,
      onDelete,
    }));
    const actionsColumn = result.current.columns.find(column => column.key === 'actions');
    const menu = actionsColumn?.render(row) as { props: { items: Array<{ id: string; onClick: () => void }> } };

    act(() => menu.props.items.find(item => item.id === 'edit')?.onClick());
    act(() => menu.props.items.find(item => item.id === 'delete')?.onClick());
    expect(onEdit).toHaveBeenCalledWith(row);
    expect(onDelete).toHaveBeenCalledWith(row);
  });

  it('emits isolated sorting, sizing, and visibility patches', () => {
    const updatePreferences = vi.fn();
    const { result } = renderHook(() => useTimesheetTable({
      canWrite: false,
      resourcesById: new Map(),
      preferences,
      updatePreferences,
      isEntryPending: () => false,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    act(() => {
      result.current.updateSorting({ key: 'hours', direction: 'asc' });
      result.current.updateColumnWidths({ note: 240 });
      result.current.updateHiddenColumns(['note']);
    });
    expect(updatePreferences.mock.calls).toEqual([
      [{ sorting: { key: 'hours', direction: 'asc' } }],
      [{ columnWidths: { note: 240 } }],
      [{ hiddenColumns: ['note'] }],
    ]);
  });
});
