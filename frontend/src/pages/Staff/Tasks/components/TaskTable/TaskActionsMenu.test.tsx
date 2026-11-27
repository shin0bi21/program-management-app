import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../common/components/ActionsMenu/ActionsMenu';
import { makeTask } from '../../../../../tests/factories/task';
import type { Task, TaskActions } from '../../types';
import TaskActionsMenu from './TaskActionsMenu';

const menu = vi.hoisted<{ ariaLabel?: string; items: ActionItem[] }>(() => ({ items: [] }));

vi.mock('../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ ariaLabel, items }: { ariaLabel?: string; items: ActionItem[] }) => {
    menu.ariaLabel = ariaLabel;
    menu.items = items;
    return <div data-testid="task-actions-menu" />;
  },
}));

function renderMenu(task: Task) {
  const actions: TaskActions = {
    isTaskPending: vi.fn(() => false),
    setState: vi.fn().mockResolvedValue(undefined),
    setTaskRange: vi.fn().mockResolvedValue(null),
    edit: vi.fn(),
    requestDelete: vi.fn(),
  };
  const rendered = render(<TaskActionsMenu task={task} actions={actions} />);

  return { ...rendered, actions };
}

function action(id: string) {
  const item = menu.items.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Missing task action: ${id}`);
  return item;
}

describe('TaskActionsMenu', () => {
  beforeEach(() => {
    menu.ariaLabel = undefined;
    menu.items = [];
    vi.clearAllMocks();
  });

  it('does not offer actions for read-only or pending tasks', () => {
    const task = makeTask({ writable: false });
    const { actions, rerender } = renderMenu(task);
    expect(screen.queryByTestId('task-actions-menu')).not.toBeInTheDocument();

    rerender(<TaskActionsMenu
      task={{ ...task, writable: true }}
      actions={{ ...actions, isTaskPending: () => true }}
    />);
    expect(screen.queryByTestId('task-actions-menu')).not.toBeInTheDocument();
  });

  it.each([
    ['untouched open task', makeTask(), ['Set Cancelled', 'Edit', 'Delete']],
    ['open task with logged time', makeTask({ hoursLogged: 1 }), ['Set Completed', 'Set Cancelled', 'Edit']],
    ['completed task', makeTask({ state: 'completed', hoursLogged: 1 }), ['Reopen task']],
    ['cancelled task without logged time', makeTask({ state: 'cancelled' }), ['Reopen task', 'Delete']],
  ])('maps capabilities for an %s', (_scenario, task, labels) => {
    renderMenu(task);

    expect(menu.items.map(item => item.label)).toEqual(labels);
  });

  it('emits the exact state, edit, and delete commands for their task', () => {
    const openTask = makeTask({ hoursLogged: 1 });
    const { actions, rerender } = renderMenu(openTask);

    action('complete').onClick();
    action('cancel').onClick();
    action('edit').onClick();
    expect(actions.setState).toHaveBeenNthCalledWith(1, openTask, 'completed');
    expect(actions.setState).toHaveBeenNthCalledWith(2, openTask, 'cancelled');
    expect(actions.edit).toHaveBeenCalledWith(openTask);

    const completedTask = makeTask({ state: 'completed', hoursLogged: 1 });
    rerender(<TaskActionsMenu task={completedTask} actions={actions} />);
    action('reopen').onClick();
    expect(actions.setState).toHaveBeenNthCalledWith(3, completedTask, 'open');

    const untouchedTask = makeTask();
    rerender(<TaskActionsMenu task={untouchedTask} actions={actions} />);
    action('delete').onClick();
    expect(actions.requestDelete).toHaveBeenCalledWith(untouchedTask);
  });
});
