import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaskItem from './TaskItem';
import type { Task } from '../../../types';

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  categoryLabel: 'Planning / Prep', programId: null, program: null, state: 'open',
  status: 'in_progress', statusLabel: 'In Progress',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 1.5,
  loggedHoursByDate: [{ date: '2026-08-10', hours: 1.5 }],
  completedAt: null, staffId: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', writable: true,
};

/**
 * Opens the task tooltip after its hover delay.
 * @example showDetails() // the visible task tooltip
 */
function showDetails() {
  fireEvent.mouseEnter(screen.getByRole('button', { name: /Prepare workshop/ }));
  act(() => vi.advanceTimersByTime(120));
  return screen.getByRole('tooltip');
}

describe('TaskItem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
  });

  afterEach(() => vi.useRealTimers());

  it('shows task details through the shared calendar-item hover behavior', async () => {
    render(<TaskItem task={{ ...task, program: 'Soft Skills', details: 'Prepare activities.' }} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const item = screen.getByRole('button', { name: /Prepare workshop.*Open actions/ });
    expect(item).toHaveTextContent('Prepare workshop · Planning / Prep');
    expect(item).not.toHaveTextContent('1.5h');
    expect(item).not.toHaveTextContent('Soft Skills');
    const tooltip = showDetails();
    expect(tooltip).toHaveTextContent('Prepare workshop');
    expect(within(tooltip).getByText('In Progress', { selector: '.status-label' })).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Planning / Prep');
    expect(tooltip).toHaveTextContent('Soft Skills');
    expect(tooltip).toHaveTextContent('Logged');
    expect(tooltip).toHaveTextContent('1.5 hours');
    expect(tooltip).toHaveTextContent('Prepare activities.');
  });

  it('shows a dash when the task has no program', async () => {
    render(<TaskItem task={task} />);

    const tooltip = showDetails();
    expect(within(tooltip).getByText('—')).toBeInTheDocument();
    expect(tooltip).not.toHaveTextContent('General');
  });

  it('opens the floating action menu while preserving calendar-wrapper activation', () => {
    const onItemActivate = vi.fn();
    const onComplete = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<div onClick={onItemActivate}><TaskItem task={task} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} /></div>);

    fireEvent.click(screen.getByRole('button', { name: 'Prepare workshop, In Progress, 2026-08-10 to 2026-08-12. Open actions' }));
    expect(onItemActivate).toHaveBeenCalledOnce();
    expect(screen.getByRole('menuitem', { name: 'Set Completed' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('emits mark complete from the task action menu', () => {
    const onComplete = vi.fn();
    render(<TaskItem task={task} onComplete={onComplete} onEdit={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set Completed' }));

    expect(onComplete).toHaveBeenCalledOnce();
  });

});
