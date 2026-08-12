import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../tasks/types';
import TimeEntryModal from './TimeEntryModal';

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  programId: null, programName: null, status: 'todo',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
};

describe('TimeEntryModal', () => {
  it('puts general-time fields in workflow order', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TimeEntryModal
      isOpen
      resources={[{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }]}
      programs={[{ id: 'program-1', name: 'Program one' }]}
      onAdd={vi.fn()}
      onClose={vi.fn()}
    /></QueryClientProvider>);

    expect(Array.from(document.getElementById('time-entry-form')!.querySelectorAll('label')).map(label => label.textContent)).toEqual([
      'Staff member', 'Program (optional)', 'Category *', 'Date', 'Hours', 'Note',
    ]);
  });

  it('puts session selection before its date and hours', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TimeEntryModal
      isOpen
      resources={[{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }]}
      programs={[]}
      initialSource="session"
      onAdd={vi.fn()}
      onClose={vi.fn()}
    /></QueryClientProvider>);

    expect(Array.from(document.getElementById('time-entry-form')!.querySelectorAll('label')).map(label => label.textContent)).toEqual([
      'Staff member', 'Session *', 'Date', 'Hours', 'Note',
    ]);
    expect(document.getElementById('time-entry-session')?.closest('.time-entry-form__source')).not.toBeNull();
  });

  it('locks a contextual task and its assigned staff while logging task time', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TimeEntryModal
      isOpen
      resources={[{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }]}
      programs={[]}
      initialTask={task}
      onAdd={onAdd}
      onClose={vi.fn()}
    /></QueryClientProvider>);

    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.getByRole('button', { name: 'Task' })).not.toHaveTextContent('Planning / Prep');
    expect(screen.getByRole('button', { name: 'Task' })).toBeDisabled();
    expect(document.getElementById('time-entry-assigned-task')?.closest('.time-entry-form__source')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    expect(Array.from(document.getElementById('time-entry-form')!.querySelectorAll('label')).map(label => label.textContent)).toEqual([
      'Staff member', 'Task *', 'Mark task complete', 'Date', 'Hours', 'Note',
    ]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark task complete' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Prepared workshop materials' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      source: 'task', taskId: 'task-1', staffId: 'staff-1', note: 'Prepared workshop materials', completeTask: true,
    })));
  });
});
