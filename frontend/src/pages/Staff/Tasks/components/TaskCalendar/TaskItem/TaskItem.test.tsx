// Scope: verifies task-item details, selection, status, and available action events.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaskItem from './TaskItem';
import type { Task } from '../../../types';

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  categoryLabel: 'Planning / Prep', programId: null, programName: null, state: 'open',
  status: 'active', statusLabel: 'Active',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 1.5,
  loggedHoursByDate: [{ date: '2026-08-10', hours: 1.5 }],
  completedAt: null, assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
};

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
    render(<TaskItem task={{ ...task, programName: 'Soft Skills', details: 'Prepare activities.' }} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const item = screen.getByRole('button', { name: /Prepare workshop.*Open actions/ });
    expect(item).toHaveTextContent('Prepare workshop · Planning / Prep');
    expect(item).not.toHaveTextContent('1.5h');
    expect(item).not.toHaveTextContent('Soft Skills');
    const tooltip = showDetails();
    expect(tooltip).toHaveTextContent('Prepare workshop');
    expect(tooltip).toHaveTextContent('Active');
    expect(tooltip).toHaveTextContent('Planning / Prep');
    expect(tooltip).toHaveTextContent('Soft Skills');
    expect(tooltip).toHaveTextContent('Logged');
    expect(tooltip).toHaveTextContent('1.5 hours');
    expect(tooltip).toHaveTextContent('Prepare activities.');
    expect([...tooltip.querySelectorAll('dt')].map(label => label.textContent)).toEqual([
      'Program', 'Category', 'Start', 'End', 'Logged', 'Notes',
    ]);
    expect(screen.getByText('2026-08-10').closest('div')).toHaveClass('calendar-item-details__section-start');
  });

  it('shows a dash when the task has no program', async () => {
    render(<TaskItem task={task} />);

    const tooltip = showDetails();
    expect(within(tooltip).getByText('—')).toBeInTheDocument();
    expect(tooltip).not.toHaveTextContent('General');
  });

  it('opens the floating action menu before invoking edit or delete', () => {
    const onActivate = vi.fn();
    const onComplete = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<div onClick={onActivate}><TaskItem task={task} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} /></div>);

    fireEvent.click(screen.getByRole('button', { name: 'Prepare workshop, Active, 2026-08-10 to 2026-08-12. Open actions' }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Set Completed' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('invokes mark complete from the task action menu', () => {
    const onComplete = vi.fn();
    render(<TaskItem task={task} onComplete={onComplete} onEdit={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set Completed' }));

    expect(onComplete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('notifies the page when the task item is activated', () => {
    const onActivate = vi.fn();
    render(<TaskItem task={task} onActivate={onActivate} />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop/ }));

    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('keeps selected task styling independent of the transient action menu', () => {
    render(<TaskItem task={task} selected onComplete={vi.fn()} />);

    const item = screen.getByRole('button', { name: /Prepare workshop.*Open actions/ });
    expect(item).toHaveClass('calendar-item--selected');
    fireEvent.click(item);
    expect(item).toHaveClass('calendar-item--selected', 'calendar-item--menu-open');
  });

  it('uses the full task bar for overdue feedback instead of a trailing symbol', async () => {
    render(<TaskItem task={{ ...task, dueDate: '2000-01-01', status: 'overdue', statusLabel: 'Overdue' }} />);

    const item = screen.getByRole('button', { name: /Prepare workshop/ });
    expect(item).toHaveClass('task-item--overdue');
    expect(item.querySelector('.calendar-item__trailing')).toBeNull();

    const tooltip = showDetails();
    expect(tooltip).toHaveTextContent('Prepare workshop');
    expect([...tooltip.querySelectorAll('.task-item__detail-badges > span')].map(badge => badge.textContent)).toEqual([
      'Overdue',
    ]);
  });

  it('uses the full task bar for completed feedback instead of a trailing symbol', async () => {
    render(<TaskItem task={{
      ...task,
      state: 'completed',
      status: 'completed',
      statusLabel: 'Completed',
      dueDate: '2000-01-01',
      completedAt: '2000-01-02T12:00:00.000Z',
    }} />);

    const item = screen.getByRole('button', { name: /Prepare workshop/ });
    expect(item).toHaveClass('task-item--completed');
    expect(item.querySelector('.calendar-item__trailing')).toBeNull();
    const tooltip = showDetails();
    expect(tooltip).toHaveTextContent('Completed');
    expect(tooltip).not.toHaveTextContent('Overdue');
  });

  it.each([
    ['Upcoming', { startDate: '2026-08-12', dueDate: '2026-08-13', status: 'upcoming' as const, statusLabel: 'Upcoming' }, 'upcoming'],
    ['Active', { startDate: '2026-08-10', dueDate: '2026-08-12', status: 'active' as const, statusLabel: 'Active' }, 'active'],
    ['Overdue', { startDate: '2026-08-08', dueDate: '2026-08-10', status: 'overdue' as const, statusLabel: 'Overdue' }, 'overdue'],
    ['Completed', { state: 'completed' as const, status: 'completed' as const, statusLabel: 'Completed' }, 'completed'],
    ['Cancelled', { state: 'cancelled' as const, status: 'cancelled' as const, statusLabel: 'Cancelled' }, 'cancelled'],
  ])('styles the task as %s', async (label, overrides, modifier) => {
    render(<TaskItem task={{ ...task, ...overrides }} />);
    const item = screen.getByRole('button', { name: /Prepare workshop/ });
    expect(item).toHaveClass(`task-item--${modifier}`);
    showDetails();

    const badge = screen.getByText(label, { selector: '.task-status-badge' });
    expect(badge).toHaveClass(`task-status-badge--${modifier}`);
  });
});
