// Scope: verifies youth-session note expansion and unlink coordination.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { unlinkSessionNoteYouth } from '../../../../Programming/Sessions/sessions.api';
import type { SessionNote } from '../../../../Programming/Sessions/types';
import type { YouthAttendanceSession } from '../types';
import useYouthSessionNotes from './useYouthSessionNotes';

vi.mock('../../../../Programming/Sessions/sessions.api', () => ({
  unlinkSessionNoteYouth: vi.fn(),
}));

const note: SessionNote = {
  id: 'note-1',
  sessionId: 'session-1',
  category: 'general',
  details: 'Follow up',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
  youth: [],
};
const session: YouthAttendanceSession = {
  id: 'session-1',
  sessionType: 'Regular',
  theme: 'Communication',
  date: '2026-08-19', startTime: '13:00', completed: true,
  cancelledAt: null,
  status: null,
  notes: null,
  sessionNotes: [note],
};

describe('useYouthSessionNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(unlinkSessionNoteYouth).mockResolvedValue(undefined);
  });

  it('coordinates expansion and the unlink lifecycle', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useYouthSessionNotes({
      youthId: 'youth-1',
      sessions: [session],
      refresh,
    }));

    expect(result.current.allExpanded).toBe(true);
    act(() => result.current.toggleAll());
    expect(result.current.isExpanded('session-1')).toBe(false);

    act(() => result.current.requestUnlink(session, note));
    expect(result.current.isChildOpen).toBe(true);

    await act(async () => result.current.confirmUnlink());

    expect(unlinkSessionNoteYouth).toHaveBeenCalledWith('session-1', 'note-1', 'youth-1');
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.current.unlinkTarget).not.toBeNull();
    act(() => result.current.closeUnlink());
    expect(result.current.unlinkTarget).toBeNull();
  });
});
