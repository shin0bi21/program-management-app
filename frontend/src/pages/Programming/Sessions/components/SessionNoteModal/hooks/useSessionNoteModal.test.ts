import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProgramSession } from '../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import {
  createSessionNote,
  getSessionRoster,
  updateSessionNote,
} from '../../../sessions.api';
import type { SessionNote } from '../../../types';
import useSessionNoteModal from './useSessionNoteModal';

vi.mock('../../../sessions.api', () => ({
  createSessionNote: vi.fn(),
  getSessionRoster: vi.fn(),
  updateSessionNote: vi.fn(),
}));

const session = makeProgramSession();
const note: SessionNote = {
  id: 'note-1',
  sessionId: session.id,
  category: 'achievement',
  details: 'Original details.',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
  youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
};

/**
 * Isolates roster queries for each note workflow example.
 * @example renderHook(useExample, { wrapper: wrapper() })
 */
function wrapper() {
  return createQueryClientWrapper(createTestQueryClient());
}

describe('useSessionNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionRoster).mockResolvedValue([]);
    vi.mocked(createSessionNote).mockResolvedValue(note);
    vi.mocked(updateSessionNote).mockResolvedValue(note);
  });

  it('initializes an edit target and submits its normalized update command', async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSessionNoteModal({
      session,
      note,
      youthId: 'other-youth',
      onSaved,
    }), { wrapper: wrapper() });

    expect(result.current.draft).toEqual({
      category: 'achievement',
      details: 'Original details.',
      youthIds: ['youth-1'],
    });
    act(() => {
      result.current.setValue('details', '  Updated details.  ');
    });
    await act(async () => result.current.submit());

    expect(updateSessionNote).toHaveBeenCalledWith(session.id, note.id, {
      category: 'achievement',
      details: 'Updated details.',
      youthIds: ['youth-1'],
    });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('loads optional roster links and reports success after create refresh succeeds', async () => {
    vi.mocked(getSessionRoster).mockResolvedValue([
      { youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson', status: null, notes: null },
    ]);
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSessionNoteModal({
      session,
      youthId: 'youth-1',
      onSaved,
    }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.roster).toHaveLength(1));
    act(() => { result.current.setValue('details', 'Attendance follow-up'); result.current.updateCategory('general'); });
    await act(async () => result.current.submit());

    expect(createSessionNote).toHaveBeenCalledWith(session.id, {
      category: 'general',
      details: 'Attendance follow-up',
      youthIds: ['youth-1'],
    });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('rejects a blank note before calling the API', async () => {
    const { result } = renderHook(() => useSessionNoteModal({
      session,
      onSaved: vi.fn(),
    }), { wrapper: wrapper() });

    await act(async () => result.current.submit());

    expect(createSessionNote).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Enter a note.');
  });

  it('does not make a saved note retryable when refresh fails', async () => {
    const { result } = renderHook(() => useSessionNoteModal({
      session,
      onSaved: vi.fn().mockRejectedValue(new Error('Refresh failed')),
    }), { wrapper: wrapper() });
    act(() => { result.current.setValue('details', 'Saved note'); result.current.updateCategory('general'); });

    await act(async () => result.current.submit());

    expect(createSessionNote).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toContain('Reload to see it');
  });

  it('reports a save failure and allows a retry', async () => {
    vi.mocked(createSessionNote).mockRejectedValueOnce(new Error('Save failed'));
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSessionNoteModal({
      session,
      onSaved,
    }), { wrapper: wrapper() });
    act(() => { result.current.setValue('details', 'Retry this note'); result.current.updateCategory('general'); });

    await act(async () => result.current.submit());

    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Save failed');
    expect(onSaved).not.toHaveBeenCalled();

    vi.mocked(createSessionNote).mockResolvedValue(note);
    await act(async () => result.current.submit());

    expect(createSessionNote).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

});
