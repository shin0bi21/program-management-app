import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CohortSession } from '../../../../../common/types/cohort';
import SessionOverview from './SessionOverview';

const getSessionNotes = vi.fn();
const getSessionRoster = vi.fn();
const deleteSessionNote = vi.fn();

vi.mock('../../../../../common/api/cohorts.api', () => ({
  getSessionNotes: (...args: unknown[]) => getSessionNotes(...args),
  getSessionRoster: (...args: unknown[]) => getSessionRoster(...args),
  createSessionNote: vi.fn(),
  updateSessionNote: vi.fn(),
  deleteSessionNote: (...args: unknown[]) => deleteSessionNote(...args),
}));

const session: CohortSession = {
  id: 'session-1',
  cohortId: 'cohort-1',
  sessionTypeId: 'type-regular',
  sessionTypeName: 'Regular',
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  theme: 'Communication',
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:00:00.000Z',
  cancelledAt: null,
  description: null,
  state: 'upcoming',
  attendedCount: 4,
  attendanceMarkedCount: 5,
  attendanceRate: 80,
};

describe('SessionOverview', () => {
  beforeEach(() => {
    getSessionNotes.mockResolvedValue([]);
    getSessionRoster.mockResolvedValue([]);
    deleteSessionNote.mockResolvedValue({});
  });

  it('keeps every card visible before a session is selected', () => {
    render(
      <SessionOverview
        session={null}
        canWriteAttendance
        canWriteNotes
        onAddAttendance={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session notes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worksheets' })).toBeInTheDocument();
    expect(screen.getAllByText('No session selected.')).toHaveLength(3);
  });

  it('summarizes attendance and delegates the add action', async () => {
    const onAddAttendance = vi.fn();
    render(
      <SessionOverview
        session={session}
        canWriteAttendance
        canWriteNotes
        onAddAttendance={onAddAttendance}
      />,
    );

    expect(screen.getByText('4/5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance' }));
    expect(onAddAttendance).toHaveBeenCalledWith(session);
    expect(await screen.findByText('No notes.')).toBeInTheDocument();
    const addNotes = screen.getByRole('button', { name: 'Add notes' });
    expect(addNotes).toBeEnabled();
    fireEvent.click(addNotes);
    expect(screen.getByRole('heading', { name: 'Add Note' })).toBeInTheDocument();
    expect(await screen.findByText('No youth are enrolled in this cohort.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add worksheets' })).toBeDisabled();
  });

  it('shows note authors and linked youth', async () => {
    getSessionNotes.mockResolvedValue([{
      id: 'note-1',
      sessionId: session.id,
      category: 'achievement',
      title: 'Led opening activity',
      details: 'Maya led the opening activity.',
      createdAt: '2026-07-28T23:30:00.000Z',
      updatedAt: '2026-07-28T23:30:00.000Z',
      createdByName: 'Programming Demo',
      youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
    }]);

    render(
      <SessionOverview
        session={session}
        canWriteAttendance
        canWriteNotes
        onAddAttendance={vi.fn()}
      />,
    );

    expect(await screen.findByText('Led opening activity')).toBeInTheDocument();
    expect(screen.getByText('Achievement')).toBeInTheDocument();
    expect(screen.getByText(/Programming Demo/)).toBeInTheDocument();
    expect(screen.queryByText('Maya led the opening activity.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Led opening activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Led opening activity' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Led opening activity' }));
    expect(screen.getByRole('heading', { name: 'Led opening activity' })).toBeInTheDocument();
    expect(screen.getByText('Maya led the opening activity.')).toBeInTheDocument();
    expect(screen.getByText('Maya Thompson')).toBeInTheDocument();
  });

  it('opens note editing and confirms deletion from the list', async () => {
    const note = {
      id: 'note-1',
      sessionId: session.id,
      category: 'achievement',
      title: 'Led opening activity',
      details: 'Maya led the opening activity.',
      createdAt: '2026-07-28T23:30:00.000Z',
      updatedAt: '2026-07-28T23:30:00.000Z',
      createdByName: 'Programming Demo',
      youth: [],
    };
    getSessionNotes.mockResolvedValue([note]);

    render(
      <SessionOverview
        session={session}
        canWriteAttendance
        canWriteNotes
        onAddAttendance={vi.fn()}
      />,
    );

    await screen.findByText(note.title);
    fireEvent.click(screen.getByRole('button', { name: `Edit ${note.title}` }));
    expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: `Delete ${note.title}` }));
    const deleteHeading = screen.getByRole('heading', { name: 'Delete Note' });
    const deleteModal = deleteHeading.closest('.modal-container');
    expect(deleteModal).not.toBeNull();
    fireEvent.click(within(deleteModal as HTMLElement).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(deleteSessionNote).toHaveBeenCalledWith(session.id, note.id);
      expect(screen.getByText('Session note successfully deleted.')).toBeInTheDocument();
    });
  });
});
