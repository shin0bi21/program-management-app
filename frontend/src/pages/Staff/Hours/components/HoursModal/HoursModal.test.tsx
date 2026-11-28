import { makeHoursItem } from '../../../../../tests/factories/hours';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import type { ComponentProps } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTask } from '../../../../../tests/factories/task';
import { getHoursSessions } from '../../api/hours.api';
import { getUser } from '../../../../../auth/storage';
import HoursModal from './HoursModal';

vi.mock('../../api/hours.api', () => ({ getHoursSessions: vi.fn() }));
vi.mock('../../../../../auth/storage', () => ({ getUser: vi.fn() }));

const loadTasks = vi.fn();

const staff = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
] as const;
const programs = [{ id: 'program-1', title: 'Soft Skills' }];
const categories = [
  { id: 'program_delivery' as const, name: 'Program Delivery' },
  { id: 'meeting' as const, name: 'Meeting' },
];
const task = makeTask();

/**
 * Opens an Hours form with reference choices and the supplied entry context.
 * @example renderModal({ target: { mode: 'task', task } }) // locked task and staff
 */
function renderModal(overrides: Partial<ComponentProps<typeof HoursModal>> = {}) {
  const props: ComponentProps<typeof HoursModal> = {
    target: { mode: 'add', context: {} },
    staff,
    programs,
    categories,
    loadTasks,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithQueryClient(<HoursModal {...props} />);
  return props;
}

/** Submits the mounted Hours form. @example submitForm() // validates and saves the draft */
function submitForm() {
  fireEvent.submit(document.getElementById('hours-form')!);
}

describe('HoursModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUser).mockReturnValue({ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', email: 'zoe@example.com' });
    loadTasks.mockResolvedValue([]);
    vi.mocked(getHoursSessions).mockResolvedValue([]);
  });

  it('defaults to the signed-in staff member while keeping the choice editable', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Staff member' })).toHaveTextContent('Zoe Wilson');
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeEnabled();
  });

  it('renders only options valid for regular time', () => {
    renderModal({ target: { mode: 'add', context: { date: '2026-08-18', staffId: 'staff-1' } } });

    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    expect(screen.queryByRole('menuitemradio', { name: 'General' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Program Delivery' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Meeting' }));
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('Meeting');
  });

  it('selects an assigned task through the rendered control', async () => {
    loadTasks.mockResolvedValue([task]);
    renderModal({ target: { mode: 'add', context: { type: 'task', date: '2026-08-18' } } });

    await waitFor(() => expect(loadTasks).toHaveBeenCalledWith(
      'staff-1',
      { signal: expect.any(AbortSignal) },
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Task' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Prepare workshop' }));
    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.queryByRole('checkbox', { name: 'Task completed' })).not.toBeInTheDocument();
  });

  it('reloads rendered session options for an editable date', async () => {
    vi.mocked(getHoursSessions).mockImplementation(async (_staffId, date) => (
      date === '2099-01-01'
        ? [{
          id: 'session-future',
          title: 'Leadership',
          date,
        }]
        : []
    ));
    renderModal({ target: { mode: 'add', context: { type: 'session' } } });

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
    renderModal({ target: { mode: 'add', context: { type: 'session', date: '2026-08-18', staffId: 'staff-2' } } });

    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-18');
    expect(screen.getByLabelText('Date')).toBeDisabled();
  });

  it('locks a contextual task and its assigned staff while logging task time', async () => {
    renderModal({ staff: [staff[0]], programs: [], target: { mode: 'task', task }, canCompleteTask: true });

    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.getByRole('button', { name: 'Task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
  });

  it('renders initialized edit values', () => {
    const item = makeHoursItem({
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
      sessionTitle: null,
      hours: 2,
      note: 'Original note',
    });
    renderModal({ target: { mode: 'edit', item } });

    expect(screen.getByRole('heading', { name: 'Edit Logged Hours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Soft Skills');
    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Note')).toHaveValue('Original note');
  });

  it('locks the form actions while submitting and displays the success status', async () => {
    let resolve!: () => void;
    const onSave = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const onClose = vi.fn();
    renderModal({ onSave, onClose, target: { mode: 'add', context: { date: '2026-08-19' } } });
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Meeting' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Pending work' } });
    submitForm();

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
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
