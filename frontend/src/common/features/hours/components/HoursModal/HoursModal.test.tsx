import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTask } from '../../../../../tests/factories/task';
import { getTasks } from '../../../tasks/tasks.api';
import { getHoursSessions } from '../../hours.api';
import HoursModal from './HoursModal';

vi.mock('../../../tasks/tasks.api', () => ({ getTasks: vi.fn() }));
vi.mock('../../hours.api', () => ({ getHoursSessions: vi.fn() }));

const resources = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
] as const;
const programs = [{ id: 'program-1', name: 'Soft Skills' }];
const task = makeTask();

function renderModal(overrides: Partial<ComponentProps<typeof HoursModal>> = {}) {
  const props: ComponentProps<typeof HoursModal> = {
    isOpen: true,
    resources,
    programs,
    onAdd: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><HoursModal {...props} /></QueryClientProvider>);
  return props;
}

function submitForm() {
  fireEvent.submit(document.getElementById('time-entry-form')!);
}

describe('HoursModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTasks).mockResolvedValue([]);
    vi.mocked(getHoursSessions).mockResolvedValue([]);
  });

  it('puts general-time fields in workflow order', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><HoursModal
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

  it('renders only options valid for regular time', () => {
    renderModal({ initialDate: '2026-08-18', initialResourceId: 'staff-1', staffLocked: true });

    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    expect(screen.queryByRole('menuitemradio', { name: 'General' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Program Delivery' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Meeting' }));
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('Meeting');
  });

  it('renders only open assigned tasks', async () => {
    vi.mocked(getTasks).mockResolvedValue([
      task,
      makeTask({ id: 'task-complete', title: 'Completed report', status: 'completed' }),
    ]);
    renderModal({ initialSource: 'task', initialDate: '2026-08-18' });

    await waitFor(() => expect(getTasks).toHaveBeenCalledWith(
      { staffId: 'staff-1' },
      { signal: expect.any(AbortSignal) },
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Task' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Completed report' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Prepare workshop' }));
    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.queryByRole('checkbox', { name: 'Mark task complete' })).not.toBeInTheDocument();
  });

  it('puts session selection before its date and hours', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><HoursModal
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

  it('reloads rendered session options for an editable date', async () => {
    vi.mocked(getHoursSessions).mockImplementation(async (_staffId, workDate) => (
      workDate === '2099-01-01'
        ? [{
          id: 'session-future',
          label: 'Leadership',
          programId: 'program-1',
          programName: 'Soft Skills',
          workDate,
          startsAt: `${workDate}T14:00:00.000Z`,
        }]
        : []
    ));
    renderModal({ initialSource: 'session' });

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2099-01-01' } });
    await waitFor(() => expect(getHoursSessions).toHaveBeenCalledWith(
      'staff-1', '2099-01-01', expect.any(AbortSignal),
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Leadership' }));
    expect(screen.getByRole('button', { name: 'Session' })).toHaveTextContent('Leadership');
  });

  it('locks a calendar-context date while loading sessions for that day', async () => {
    vi.mocked(getHoursSessions).mockResolvedValue([{
      id: 'session-1',
      label: 'Confidence',
      programId: 'program-1',
      programName: 'Soft Skills',
      workDate: '2026-08-18',
      startsAt: '2026-08-18T14:00:00.000Z',
    }]);
    renderModal({ initialSource: 'session', initialDate: '2026-08-18', initialResourceId: 'staff-2' });

    await waitFor(() => expect(getHoursSessions).toHaveBeenCalledWith(
      'staff-2', '2026-08-18', expect.any(AbortSignal),
    ));
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-18');
    expect(screen.getByLabelText('Date')).toBeDisabled();
  });

  it('locks a contextual task and its assigned staff while logging task time', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><HoursModal
      isOpen
      resources={[{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }]}
      programs={[]}
      initialTask={task}
      canCompleteTask
      onAdd={vi.fn()}
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
  });

  it('renders initialized edit values', () => {
    renderModal({
      initialDate: '2026-08-18',
      initialResourceId: 'staff-1',
      initialItem: {
        id: 'entry-1',
        category: 'meeting',
        categoryLabel: 'Meeting',
        programId: 'program-1',
        programName: 'Soft Skills',
        cycleId: '',
        cycleName: '',
        taskId: null,
        taskTitle: null,
        sessionId: null,
        sessionLabel: null,
        hours: 2,
        note: 'Original note',
      },
    });

    expect(screen.getByRole('heading', { name: 'Edit Logged Hours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Soft Skills');
    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Note')).toHaveValue('Original note');
  });

  it('keeps the success state visible after preventing dismissal while submitting', async () => {
    let resolve!: () => void;
    const onAdd = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const onClose = vi.fn();
    renderModal({ onAdd, onClose });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Pending work' } });
    submitForm();

    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    const dialog = screen.getByRole('dialog', { name: 'Log Hours' });
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    resolve();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(
      'Hours logged successfully.',
    ));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
