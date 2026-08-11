import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../tasks/types';
import TimeEntryModal from './TimeEntryModal';

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026', status: 'todo',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
};

describe('TimeEntryModal', () => {
  it('locks a contextual task and its assigned staff while logging task time', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TimeEntryModal
      isOpen
      resources={[{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true }]}
      programs={[]}
      cycles={[{ id: 'cycle-1', name: 'Summer 2026' }]}
      initialTask={task}
      onAdd={onAdd}
      onClose={vi.fn()}
    /></QueryClientProvider>);

    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.getByRole('button', { name: 'Task' })).not.toHaveTextContent('Planning / Prep');
    expect(screen.getByRole('button', { name: 'Task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Prepared workshop materials' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      source: 'task', taskId: 'task-1', staffId: 'staff-1', note: 'Prepared workshop materials',
    })));
  });
});
