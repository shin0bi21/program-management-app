import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCohortSession } from '../../../../../tests/factories/session';
import type SessionAttachmentsDashboardCard from './SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import type SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import type SessionNotesDashboardCard from './SessionNotesDashboardCard/SessionNotesDashboardCard';
import SessionDashboard from './SessionDashboard';

type AttendanceCardProps = ComponentProps<typeof SessionAttendanceDashboardCard>;
type NotesCardProps = ComponentProps<typeof SessionNotesDashboardCard>;
type AttachmentsCardProps = ComponentProps<typeof SessionAttachmentsDashboardCard>;

const childCardProps = vi.hoisted(() => ({
  attendance: vi.fn<(props: AttendanceCardProps) => void>(),
  notes: vi.fn<(props: NotesCardProps) => void>(),
  attachments: vi.fn<(props: AttachmentsCardProps) => void>(),
}));

vi.mock('./SessionAttendanceDashboardCard/SessionAttendanceDashboardCard', () => ({
  default: (props: AttendanceCardProps) => {
    childCardProps.attendance(props);

    return <button onClick={() => props.session && props.onManage(props.session)}>Manage attendance</button>;
  },
}));

vi.mock('./SessionNotesDashboardCard/SessionNotesDashboardCard', () => ({
  default: (props: NotesCardProps) => {
    childCardProps.notes(props);

    return <div data-testid="notes-card" />;
  },
}));

vi.mock('./SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard', () => ({
  default: (props: AttachmentsCardProps) => {
    childCardProps.attachments(props);

    return <div data-testid="attachments-card" />;
  },
}));

describe('SessionDashboard', () => {
  beforeEach(() => {
    childCardProps.attendance.mockClear();
    childCardProps.notes.mockClear();
    childCardProps.attachments.mockClear();
  });

  it('keeps every card composed before a session is selected', () => {
    render(
      <SessionDashboard
        sessionQueryKey={['sessions']}
        session={null}
        canWriteAttendance
        canWriteSessions
        onAddAttendance={vi.fn()}
      />,
    );

    expect(childCardProps.attendance).toHaveBeenCalledWith(expect.objectContaining({ session: null }));
    expect(screen.getByTestId('notes-card')).toBeInTheDocument();
    expect(screen.getByTestId('attachments-card')).toBeInTheDocument();
  });

  it('forwards selected context and card errors, and delegates attendance management', async () => {
    const session = makeCohortSession();
    const queryKey = ['sessions', 'program-1'] as const;
    const onAddAttendance = vi.fn();
    const onErrorsChange = vi.fn();

    render(
      <SessionDashboard
        sessionQueryKey={queryKey}
        session={session}
        canWriteAttendance
        canWriteSessions={false}
        onAddAttendance={onAddAttendance}
        onErrorsChange={onErrorsChange}
      />,
    );

    expect(childCardProps.attendance).toHaveBeenCalledWith({
      session,
      canWrite: true,
      onManage: onAddAttendance,
    });
    expect(childCardProps.notes).toHaveBeenCalledWith(expect.objectContaining({
      queryKey,
      session,
      canWrite: false,
      onErrorChange: expect.any(Function),
    }));
    expect(childCardProps.attachments).toHaveBeenCalledWith(expect.objectContaining({
      queryKey,
      session,
      canWrite: false,
      onErrorChange: expect.any(Function),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance' }));
    expect(onAddAttendance).toHaveBeenCalledWith(session);

    const notesProps = childCardProps.notes.mock.lastCall![0];
    act(() => notesProps.onErrorChange!({ message: 'Could not load notes' }));

    await waitFor(() => expect(onErrorsChange).toHaveBeenCalledWith([
      { message: 'Could not load notes' },
    ]));
  });
});
