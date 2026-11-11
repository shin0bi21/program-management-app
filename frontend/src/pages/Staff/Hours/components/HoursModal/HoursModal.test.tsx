import { makeHoursItem } from '../../../../../tests/factories/hours';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import type { ComponentProps } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTask } from '../../../../../tests/factories/task';
import { getHoursSessions } from '../../hours.api';
import HoursModal from './HoursModal';

vi.mock('../../hours.api', () => ({ getHoursSessions: vi.fn() }));

const loadTasks = vi.fn();

const resources = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
] as const;
const programs = [{ id: 'program-1', name: 'Soft Skills' }];
const categories = [
  { value: 'program_delivery' as const, label: 'Program Delivery' },
  { value: 'meeting' as const, label: 'Meeting' },
];
const task = makeTask();

function renderModal(overrides: Partial<ComponentProps<typeof HoursModal>> = {}) {
  const props: ComponentProps<typeof HoursModal> = {
    isOpen: true,
    initialStaffId: 'staff-1',
    resources,
    programs,
    categories,
    loadTasks,
    onAdd: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithQueryClient(<HoursModal {...props} />);
  return props;
}

function submitForm() {
  fireEvent.submit(document.getElementById('hours-form')!);
}

describe('HoursModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadTasks.mockResolvedValue([]);
    vi.mocked(getHoursSessions).mockResolvedValue([]);
  });

  it('renders only options valid for regular time', () => {
    renderModal({ initialDate: '2026-08-18', initialStaffId: 'staff-1', staffLocked: true });

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
    loadTasks.mockResolvedValue([
      task,
      makeTask({ id: 'task-complete', title: 'Completed report', state: 'completed', status: 'completed', statusLabel: 'Completed' }),
    ]);
    renderModal({ initialSource: 'task', initialDate: '2026-08-18' });

    await waitFor(() => expect(loadTasks).toHaveBeenCalledWith(
      'staff-1',
      { signal: expect.any(AbortSignal) },
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Task' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Completed report' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Prepare workshop' }));
    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.queryByRole('checkbox', { name: 'Task completed' })).not.toBeInTheDocument();
  });

  it('reloads rendered session options for an editable date', async () => {
    vi.mocked(getHoursSessions).mockImplementation(async (_staffId, date) => (
      date === '2099-01-01'
        ? [{
          id: 'session-future',
          label: 'Leadership',
          date,
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

  it('locks the work date when opened from a calendar cell', async () => {
    renderModal({ initialSource: 'session', initialDate: '2026-08-18', initialStaffId: 'staff-2' });

    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-18');
    expect(screen.getByLabelText('Date')).toBeDisabled();
  });

  it('locks a contextual task and its assigned staff while logging task time', async () => {
    renderModal({ resources: [resources[0]], programs: [], initialTask: task, canCompleteTask: true });

    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.getByRole('button', { name: 'Task' })).not.toHaveTextContent('Planning / Prep');
    expect(screen.getByRole('button', { name: 'Task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
  });

  it('renders initialized edit values', () => {
    renderModal({
      initialItem: makeHoursItem({
        id: 'entry-1',
        category: 'meeting',
        categoryLabel: 'Meeting',
        programId: 'program-1',
        program: 'Soft Skills',
        cycleId: '',
        cycle: '',
        taskId: null,
        taskTitle: null,
        sessionId: null,
        sessionLabel: null,
        hours: 2,
        note: 'Original note',
      }),
    });

    expect(screen.getByRole('heading', { name: 'Edit Logged Hours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Soft Skills');
    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Note')).toHaveValue('Original note');
  });

  it('locks the form actions while submitting and displays the success status', async () => {
    let resolve!: () => void;
    const onAdd = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const onClose = vi.fn();
    renderModal({ onAdd, onClose, initialDate: '2026-08-19' });
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Meeting' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Pending work' } });
    submitForm();

    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    resolve();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(
      'Hours logged successfully.',
    ));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
