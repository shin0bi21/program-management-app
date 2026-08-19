// Scope: verifies youth-attendance note dialogs pass the selected youth and session context.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeYouthProfile } from '../../../../../tests/factories/youth';
import YouthSessionNoteDialogs from './YouthSessionNoteDialogs';

const sessionNoteModalState = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock('../../../../../common/features/notes/components/SessionNoteModal/SessionNoteModal', () => ({
  default: (props: Record<string, unknown>) => {
    sessionNoteModalState.props = props;
    return <div aria-label="Session note editor" />;
  },
}));

describe('YouthSessionNoteDialogs', () => {
  it('wires the selected youth and session into the note editor', () => {
    const onCloseNote = vi.fn();
    const onNoteSaved = vi.fn().mockResolvedValue(undefined);

    render(<YouthSessionNoteDialogs
      youth={makeYouthProfile({ id: 'youth-1' })}
      rosterMode="open"
      noteTarget={{
        session: {
          id: 'session-1',
          sessionTypeName: 'Regular',
          theme: 'Communication',
          startsAt: '2026-08-19T17:00:00.000Z',
          endsAt: '2026-08-19T19:00:00.000Z',
          cancelledAt: null,
          status: null,
          notes: null,
          sessionNotes: [],
        },
        note: null,
      }}
      unlinkTarget={null}
      unlinking={false}
      unlinkError=""
      onCloseNote={onCloseNote}
      onNoteSaved={onNoteSaved}
      onCloseUnlink={vi.fn()}
      onConfirmUnlink={vi.fn()}
    />);

    expect(screen.getByLabelText('Session note editor')).toBeInTheDocument();
    expect(sessionNoteModalState.props).toEqual(expect.objectContaining({
      session: { id: 'session-1', rosterMode: 'open' },
      initialYouthId: 'youth-1',
      hideYouthSelection: true,
      onClose: onCloseNote,
      onSaved: onNoteSaved,
    }));
  });
});
