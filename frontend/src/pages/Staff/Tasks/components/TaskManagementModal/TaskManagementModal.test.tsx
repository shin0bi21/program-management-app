import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import queryClient from '../../../../../query/queryClient';
import { createTask, getTasks } from '../../../../../common/features/tasks/api/tasks.api';
import TaskManagementModal from './TaskManagementModal';

vi.mock('../../../../../common/features/tasks/api/tasks.api', () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
}));


describe('TaskManagementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    vi.mocked(getTasks).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'task-1', title: 'Create marketing poster', details: null, category: 'outreach',
      programId: null, programName: null, cycleId: 'cycle-general', cycleName: 'Summer 2026',
      status: 'todo', startDate: '2026-08-10', dueDate: '2026-08-14', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
      assignee: { id: 'staff-1', name: 'Zoe Wilson' }, writable: true,
    });
  });

  it('creates a categorized task with selected staff assignments', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TaskManagementModal
          isOpen
          resources={[{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true }]}
          programs={[]}
          cycles={[{ id: 'cycle-general', name: 'Summer 2026', programId: 'program-any', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' }]}
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('dialog', { name: 'Add task' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Existing tasks' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Task title *'), { target: { value: 'Create marketing poster' } });
    fireEvent.click(screen.getByRole('button', { name: 'Task cycle' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Summer 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Task staff' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Zoe Wilson' }));
    fireEvent.change(screen.getByLabelText('Start date *'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Due date *'), { target: { value: '2026-08-14' } });
    fireEvent.submit(document.getElementById('task-form')!);

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Create marketing poster',
      category: 'outreach',
      startDate: '2026-08-10',
      dueDate: '2026-08-14',
      staffId: 'staff-1',
      cycleId: 'cycle-general',
    })));
  });

  it('limits cycles to the selected program and submits the selected scope', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TaskManagementModal
          isOpen
          resources={[{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true }]}
          programs={[{ id: 'program-soft', name: 'Soft Skills' }, { id: 'program-other', name: 'Other Program' }]}
          cycles={[
            { id: 'cycle-soft', name: 'Fall 2026', programId: 'program-soft', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming' },
            { id: 'cycle-other', name: 'Spring 2027', programId: 'program-other', startsOn: '2027-02-01', endsOn: '2027-05-01', state: 'upcoming' },
          ]}
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText('Task title *'), { target: { value: 'Plan workshop' } });
    fireEvent.change(screen.getByLabelText('Start date *'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Due date *'), { target: { value: '2026-08-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Task program' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Task cycle' }));
    expect(screen.getByRole('menuitemradio', { name: 'Fall 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Spring 2027' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Fall 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Task staff' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Zoe Wilson' }));
    fireEvent.submit(document.getElementById('task-form')!);

    await waitFor(() => expect(createTask).toHaveBeenLastCalledWith(expect.objectContaining({
      programId: 'program-soft', cycleId: 'cycle-soft', staffId: 'staff-1',
    })));
  });

  it('uses the calendar row staff assignment without showing assignment controls', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TaskManagementModal
          isOpen
          resources={[{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true }]}
          programs={[]}
          cycles={[{ id: 'cycle-general', name: 'Summer 2026', programId: 'program-any', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' }]}
          initialStartDate="2026-08-10"
          initialDueDate="2026-08-10"
          fixedStaffId="staff-1"
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Task staff' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Task title *'), { target: { value: 'Calendar task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Task cycle' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Summer 2026' }));
    fireEvent.submit(document.getElementById('task-form')!);

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2026-08-10',
      dueDate: '2026-08-10',
      staffId: 'staff-1',
    })));
  });

  it('moves the due date with a newly selected start date', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TaskManagementModal
          isOpen
          resources={[{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true }]}
          programs={[]}
          cycles={[]}
          initialStartDate="2026-08-10"
          initialDueDate="2026-08-14"
          fixedStaffId="staff-1"
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const startDate = screen.getByLabelText('Start date *');
    const dueDate = screen.getByLabelText('Due date *');
    expect(startDate).not.toHaveAttribute('max');

    fireEvent.change(startDate, { target: { value: '2026-09-20' } });

    expect(startDate).toHaveValue('2026-09-20');
    expect(dueDate).toHaveValue('2026-09-20');
    expect(dueDate).toHaveAttribute('min', '2026-09-20');
  });

  it('does not offer cancellation for an in-progress task', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TaskManagementModal
          isOpen
          task={{
            id: 'task-1', title: 'Active task', details: null, category: 'outreach',
            programId: null, programName: null, cycleId: 'cycle-general', cycleName: 'Summer 2026',
            status: 'in_progress', startDate: '2026-08-10', dueDate: '2026-08-14',
            hoursLogged: 1, loggedHoursByDate: [{ date: '2026-08-10', hours: 1 }], completedAt: null, assignee: { id: 'staff-1', name: 'Zoe Wilson' }, writable: true,
          }}
          resources={[{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true }]}
          programs={[]}
          cycles={[{ id: 'cycle-general', name: 'Summer 2026', programId: 'program-any', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' }]}
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Task status' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Cancelled' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start date *')).not.toBeDisabled();
    expect(screen.getByLabelText('Due date *')).not.toBeDisabled();
  });
});
