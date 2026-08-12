import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import render from '../../../../../tests/renderWithQueryClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CohortSession } from '../../../../../common/types/cohort';
import SessionDashboard from './SessionDashboard';

const getSessionNotes = vi.fn();
const getSessionRoster = vi.fn();
const deleteSessionNote = vi.fn();
const getSessionAttachments = vi.fn();
const getSessionAttachmentFile = vi.fn();
const updateSessionAttachment = vi.fn();
const deleteSessionAttachment = vi.fn();
const zoomIn = vi.fn();
const zoomOut = vi.fn();
const resetZoom = vi.fn();
const destroyPanzoom = vi.fn();
const initializePanzoom = vi.fn((_element: unknown, _options?: unknown) => ({
  destroy: destroyPanzoom,
  reset: resetZoom,
  zoomIn,
  zoomOut,
  zoomWithWheel: vi.fn(),
}));

vi.mock('@panzoom/panzoom', () => ({
  default: (element: unknown, options?: unknown) => initializePanzoom(element, options),
}));

vi.mock('../../../../../common/features/programming/api/programming.api', () => ({
  getSessionNotes: (...args: unknown[]) => getSessionNotes(...args),
  getSessionRoster: (...args: unknown[]) => getSessionRoster(...args),
  createSessionNote: vi.fn(),
  updateSessionNote: vi.fn(),
  deleteSessionNote: (...args: unknown[]) => deleteSessionNote(...args),
  getSessionAttachments: (...args: unknown[]) => getSessionAttachments(...args),
  createSessionAttachment: vi.fn(),
  deleteSessionAttachment: (...args: unknown[]) => deleteSessionAttachment(...args),
  updateSessionAttachment: (...args: unknown[]) => updateSessionAttachment(...args),
  getSessionAttachmentFile: (...args: unknown[]) => getSessionAttachmentFile(...args),
  downloadSessionAttachment: vi.fn(),
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

describe('SessionDashboard', () => {
  beforeEach(() => {
    getSessionNotes.mockResolvedValue([]);
    getSessionRoster.mockResolvedValue([]);
    deleteSessionNote.mockResolvedValue({});
    getSessionAttachments.mockResolvedValue([]);
    getSessionAttachmentFile.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
    updateSessionAttachment.mockResolvedValue({});
    deleteSessionAttachment.mockResolvedValue({});
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:attachment-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('keeps every card visible before a session is selected', () => {
    render(
      <SessionDashboard
        session={null}
        canWriteAttendance
        canWriteSessions
        onAddAttendance={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session Notes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attachments' })).toBeInTheDocument();
    expect(screen.getAllByText('No session selected.')).toHaveLength(3);
  });

  it('summarizes attendance and delegates the add action', async () => {
    const onAddAttendance = vi.fn();
    render(
      <SessionDashboard
        session={session}
        canWriteAttendance
        canWriteSessions
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
    expect(screen.getByRole('button', { name: 'Add attachments' })).toBeEnabled();
  });

  it('shows consistent note metadata and linked youth details', async () => {
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
      <SessionDashboard
        session={session}
        canWriteAttendance
        canWriteSessions
        onAddAttendance={vi.fn()}
      />,
    );

    expect(await screen.findByText('Led opening activity')).toBeInTheDocument();
    expect(screen.getByText('Achievement')).toBeInTheDocument();
    expect(screen.getByText('Jul 28, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Maya led the opening activity.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Led opening activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Led opening activity' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Led opening activity' }));
    expect(screen.getByRole('heading', { name: 'Led opening activity' })).toBeInTheDocument();
    expect(screen.getByText(/Programming Demo/)).toBeInTheDocument();
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
      <SessionDashboard
        session={session}
        canWriteAttendance
        canWriteSessions
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

  it('shows attachment titles with view, edit, and delete actions', async () => {
    const attachment = {
      id: 'attachment-1',
      sessionId: session.id,
      title: 'Workshop photo',
      description: 'Youth presenting their work.',
      originalFilename: 'IMG_0042.png',
      mimeType: 'image/png',
      fileSize: 2048,
      createdAt: '2026-07-28T23:30:00.000Z',
      updatedAt: '2026-07-28T23:30:00.000Z',
      createdByName: 'Programming Demo',
      youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
    };
    getSessionAttachments.mockResolvedValue([attachment]);

    render(
      <SessionDashboard
        session={session}
        canWriteAttendance
        canWriteSessions
        onAddAttendance={vi.fn()}
      />,
    );

    expect(await screen.findByText('Workshop photo')).toBeInTheDocument();
    expect(screen.queryByText(/IMG_0042/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Workshop photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Workshop photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Workshop photo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View Workshop photo' }));
    expect(await screen.findByRole('img', { name: 'Workshop photo' })).toHaveAttribute('src', 'blob:attachment-preview');
    expect(screen.queryByText('Youth presenting their work.')).not.toBeInTheDocument();
    expect(screen.queryByText('Programming Demo')).not.toBeInTheDocument();
    expect(screen.queryByText('2 KB')).not.toBeInTheDocument();
    await waitFor(() => expect(initializePanzoom).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(zoomIn).toHaveBeenCalledWith({ animate: true });
    expect(zoomOut).toHaveBeenCalledWith({ animate: true });
    expect(resetZoom).toHaveBeenCalledWith({ animate: true });
    fireEvent.click(screen.getByText('Close', { selector: 'button' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Workshop photo' }));
    expect(screen.getByRole('heading', { name: 'Edit Attachment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Workshop photo');
    expect(screen.queryByLabelText('File')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed photo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateSessionAttachment).toHaveBeenCalledWith(
      session.id,
      attachment.id,
      {
        title: 'Renamed photo',
        description: attachment.description,
        youthIds: ['youth-1'],
      },
    ));
  });
});
