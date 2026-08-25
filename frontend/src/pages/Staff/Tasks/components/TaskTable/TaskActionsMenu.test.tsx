// Scope: verifies capability-gated Task row actions and emitted task commands.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeTask } from '../../../../../tests/factories/task';
import TaskActionsMenu from './TaskActionsMenu';

describe('TaskActionsMenu', () => {
  it('renders allowed actions and emits the selected status command', () => {
    const task = makeTask();
    const setState = vi.fn().mockResolvedValue(undefined);
    render(<TaskActionsMenu
      task={task}
      isTaskPending={() => false}
      setState={setState}
      edit={vi.fn()}
      requestDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: `Actions for ${task.title}` }));
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Set Cancelled', 'Edit', 'Delete',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set Cancelled' }));
    expect(setState).toHaveBeenCalledWith(task, 'cancelled');
  });
});
