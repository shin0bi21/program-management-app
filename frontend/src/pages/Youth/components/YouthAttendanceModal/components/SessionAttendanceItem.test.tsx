import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionNote } from '../../../../Programming/Sessions/types';
import SessionAttendanceItem from './SessionAttendanceItem';

vi.mock('../../../../../common/features/AttendanceStatusSelect/AttendanceStatusSelect', () => ({
  default: () => <div aria-label="Attendance status" />,
}));

const note = {
  id: 'note-1', sessionId: 'session-1', category: 'general', details: 'Checked in.',
  createdAt: '2026-08-19T17:00:00.000Z', updatedAt: '2026-08-19T17:00:00.000Z',
  createdByName: null, youth: [],
} satisfies SessionNote;

describe('SessionAttendanceItem', () => {
  it('wires expanded note actions to the selected session note', () => {
    const onViewNote = vi.fn();
    const onEditNote = vi.fn();
    const onUnlinkNote = vi.fn();
    render(<SessionAttendanceItem
      session={{
        id: 'session-1', sessionType: 'Workshop', title: 'Communication',
        date: '2026-08-19', startTime: '13:00', completed: true,
        cancelledAt: null, status: 'present', notes: null, sessionNotes: [note],
      }}
      enrollmentRequired={true}
      status="present"
      canManageSessionNotes
      notesExpanded
      onStatusChange={vi.fn()}
      onToggleNotes={vi.fn()}
      onAddNote={vi.fn()}
      onViewNote={onViewNote}
      onEditNote={onEditNote}
      onUnlinkNote={onUnlinkNote}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'View session note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit session note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink session note' }));

    expect(onViewNote).toHaveBeenCalledWith(note);
    expect(onEditNote).toHaveBeenCalledWith(note);
    expect(onUnlinkNote).toHaveBeenCalledWith(note);
  });
});
