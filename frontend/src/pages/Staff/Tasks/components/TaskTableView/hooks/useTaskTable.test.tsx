// Scope: verifies task columns, row actions, sorting, widths, and visibility preferences.
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import { makeTask } from '../../../../../../tests/factories/task';
import type { TaskPreferences } from '../../../types';
import useTaskTable from './useTaskTable';

const actionMenu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));

vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    actionMenu.items = items;
    return <div data-testid="actions-menu" />;
  },
}));

const preferences: TaskPreferences = {
  view: 'calendar',
  staffIds: [],
  programIds: [],
  categories: [],
  statuses: [],
  sorting: { key: 'startDate', direction: 'asc' },
  columnWidths: {},
  hiddenColumns: [],
};

function renderTable(canWrite: boolean) {
  const updatePreferences = vi.fn();
  const actions = {
    isTaskPending: vi.fn(() => false),
    setStatus: vi.fn().mockResolvedValue(undefined),
    edit: vi.fn(),
    requestDelete: vi.fn(),
  };
  const rendered = renderHook(() => useTaskTable({
    canWrite,
    today: '2026-08-11',
    preferences,
    updatePreferences,
    actions,
  }));
  return { ...rendered, actions, updatePreferences };
}

describe('useTaskTable', () => {
  it('emits one owned patch per table preference change', () => {
    const rendered = renderTable(false);

    act(() => {
      rendered.result.current.updateSorting({ key: 'dueDate', direction: 'desc' });
      rendered.result.current.updateColumnWidths({ title: 280 });
      rendered.result.current.updateHiddenColumns(['program']);
    });

    expect(rendered.updatePreferences.mock.calls).toEqual([
      [{ sorting: { key: 'dueDate', direction: 'desc' } }],
      [{ columnWidths: { title: 280 } }],
      [{ hiddenColumns: ['program'] }],
    ]);
  });

  it('returns data columns only for read-only users', () => {
    const rendered = renderTable(false);

    expect(rendered.result.current.columns.map(column => column.key)).toEqual([
      'firstName', 'lastName', 'title', 'program', 'category', 'startDate', 'dueDate', 'status',
    ]);
  });

  it('builds capability-gated actions and forwards the selected action', async () => {
    const user = userEvent.setup();
    const task = makeTask();
    const rendered = renderTable(true);
    const actionColumn = rendered.result.current.columns.find(column => column.key === 'actions')!;

    render(<>{actionColumn.render(task)}</>);
    expect(screen.getByTestId('actions-menu')).toBeInTheDocument();
    expect(actionMenu.items.map(item => item.label)).toEqual(['Set Cancelled', 'Edit', 'Delete']);

    render(<button onClick={actionMenu.items[0].onClick}>Cancel</button>);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rendered.actions.setStatus).toHaveBeenCalledWith(task, 'cancelled');
  });
});
