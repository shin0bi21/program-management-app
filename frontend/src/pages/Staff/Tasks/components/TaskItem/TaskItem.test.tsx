import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskItem from './TaskItem';
import type { Task } from '../../../../../common/features/tasks/types';

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026', status: 'todo',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 1.5,
  loggedHoursByDate: [{ date: '2026-08-10', hours: 1.5 }],
  completedAt: null, assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
};

describe('TaskItem', () => {
  it('shows task details through the shared calendar-item hover behavior', async () => {
    render(<TaskItem task={{ ...task, programName: 'Soft Skills', cycleName: 'Summer 2026', details: 'Prepare activities.' }} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const item = screen.getByRole('button', { name: /Prepare workshop.*Open actions/ });
    expect(item).toHaveTextContent('Prepare workshop · Planning / Prep');
    expect(item).not.toHaveTextContent('1.5h');
    expect(item).not.toHaveTextContent('Soft Skills');
    fireEvent.mouseEnter(item);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Prepare workshop');
    expect(tooltip).toHaveTextContent('To do');
    expect(tooltip).toHaveTextContent('Planning / Prep');
    expect(tooltip).toHaveTextContent('Soft Skills');
    expect(tooltip).toHaveTextContent('Summer 2026');
    expect(tooltip).toHaveTextContent('Logged');
    expect(tooltip).toHaveTextContent('1.5 hours');
    expect(tooltip).toHaveTextContent('Prepare activities.');
    expect([...tooltip.querySelectorAll('dt')].map(label => label.textContent)).toEqual([
      'Program', 'Cycle', 'Category', 'Start', 'End', 'Logged', 'Notes',
    ]);
    expect(screen.getByText('2026-08-10').closest('div')).toHaveClass('calendar-item-details__section-start');
  });

  it('opens the floating action menu before invoking edit or delete', () => {
    const onActivate = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<div onClick={onActivate}><TaskItem task={task} onEdit={onEdit} onDelete={onDelete} /></div>);

    fireEvent.click(screen.getByRole('button', { name: 'Prepare workshop, 2026-08-10 to 2026-08-12. Open actions' }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('notifies the page when the task item is activated', () => {
    const onActivate = vi.fn();
    render(<TaskItem task={task} onActivate={onActivate} />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop/ }));

    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('shows an overdue status at the end of an active task item', async () => {
    render(<TaskItem task={{ ...task, dueDate: '2000-01-01' }} />);

    const overdue = screen.getByLabelText('Overdue');
    expect(overdue).toHaveTextContent('!');
    expect(overdue).toHaveAttribute('title', 'Overdue');

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Prepare workshop/ }));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Prepare workshop');
    expect(tooltip.querySelector('.task-item__overdue-badge')).toHaveTextContent('Overdue');
    expect([...tooltip.querySelectorAll('.task-item__detail-badges > span')].map(badge => badge.textContent)).toEqual([
      'To do', 'Overdue',
    ]);
  });

  it('shows completed status without marking the task overdue', async () => {
    render(<TaskItem task={{
      ...task,
      status: 'completed',
      dueDate: '2000-01-01',
      completedAt: '2000-01-02T12:00:00.000Z',
    }} />);

    expect(screen.queryByLabelText('Overdue')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Prepare workshop/ }));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Completed');
    expect(tooltip).not.toHaveTextContent('Overdue');
  });

  it.each([
    ['todo', 'To do'],
    ['in_progress', 'In progress'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
  ] as const)('styles the %s status as a title badge', async (status, label) => {
    render(<TaskItem task={{ ...task, status }} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Prepare workshop/ }));

    const badge = await screen.findByText(label, { selector: '.task-item__status-badge' });
    expect(badge).toHaveClass(`task-item__status-badge--${status}`);
  });
});
