import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTask } from '../../tasks.api';
import { makeTask } from '../../../../../tests/factories/task';

import TaskModal from './TaskModal';

vi.mock('../../tasks.api', () => ({
  setTask: vi.fn(),
}));

const resources = [{
  id: 'staff-1',
  firstName: 'Zoe',
  lastName: 'Wilson',
  name: 'Zoe Wilson',
  role: 'staff',
  writable: true,
}];
const programs = [{ id: 'program-soft', name: 'Soft Skills' }];
const categories = [{ value: 'planning_prep' as const, label: 'Planning / Prep' }];

describe('TaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the accessible create fields and required controls', () => {
    render(<TaskModal
      target={{ mode: 'add', initialValues: { startDate: '', dueDate: '' } }}
      resources={resources}
      programs={programs}
      categories={categories}
      onSaved={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.getByRole('dialog', { name: 'Add Task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Task title *')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Task staff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Task program' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Task category' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start date *')).toBeRequired();
    expect(screen.getByLabelText('Due date *')).toBeRequired();
    expect(screen.getByLabelText('Details (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
  });

  it('uses the calendar context without rendering an editable staff control', () => {
    render(<TaskModal
      target={{
        mode: 'add',
        initialValues: {
          startDate: '2026-08-10',
          dueDate: '2026-08-10',
          staffId: 'staff-1',
        },
      }}
      resources={resources}
      programs={programs}
      categories={categories}
      onSaved={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.queryByRole('button', { name: 'Task staff' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start date *')).toHaveValue('2026-08-10');
    expect(screen.getByLabelText('Due date *')).toHaveValue('2026-08-10');
    expect(screen.getByLabelText('Due date *')).toHaveAttribute('min', '2026-08-10');
  });

  it('disables modal controls while the task is submitting', () => {
    vi.mocked(setTask).mockReturnValue(new Promise(() => undefined));
    render(<TaskModal
      target={{
        mode: 'add',
        initialValues: {
          startDate: '2026-08-10',
          dueDate: '2026-08-14',
          staffId: 'staff-1',
        },
      }}
      resources={resources}
      programs={programs}
      categories={categories}
      onSaved={vi.fn()}
      onClose={vi.fn()}
    />);

    fireEvent.change(screen.getByLabelText('Task title *'), { target: { value: 'Calendar task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Task category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Planning / Prep' }));
    fireEvent.submit(document.getElementById('task-form')!);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Task program' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Task category' })).toBeDisabled();
    expect(screen.getByLabelText('Start date *')).toBeDisabled();
    expect(screen.getByLabelText('Due date *')).toBeDisabled();
  });

  it('keeps lifecycle controls out of the edit form', () => {
    render(<TaskModal
      target={{
        mode: 'edit',
        task: makeTask({
          title: 'Active task',
          hoursLogged: 1,
          loggedHoursByDate: [{ date: '2026-08-10', hours: 1 }],
        }),
      }}
      resources={resources}
      programs={programs}
      categories={categories}
      onSaved={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.getByRole('dialog', { name: 'Edit Task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Task status' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start date *')).not.toBeDisabled();
    expect(screen.getByLabelText('Due date *')).not.toBeDisabled();
  });
});
