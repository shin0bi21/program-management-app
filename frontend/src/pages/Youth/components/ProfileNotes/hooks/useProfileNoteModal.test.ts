// Owns profile-note create/edit initialization, normalized commands, and validation.
import type { FormEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setYouthProfileNote } from '../../../../../common/features/youth/youth.api';
import type { YouthProfileNote } from '../../../../../common/types/youth';
import useProfileNoteModal from './useProfileNoteModal';

vi.mock('../../../../../common/features/youth/youth.api', () => ({
  setYouthProfileNote: vi.fn(),
}));

const note: YouthProfileNote = {
  id: 'note-1',
  youthId: 'youth-1',
  category: 'health',
  title: 'Allergy plan',
  details: 'Carry medication.',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
};

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
}

describe('useProfileNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setYouthProfileNote).mockResolvedValue(note);
  });

  it('initializes and submits a normalized edit command', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProfileNoteModal({
      youthId: 'youth-1',
      note,
      onSaved,
    }));

    expect(result.current.draft).toEqual({
      category: 'health',
      title: 'Allergy plan',
      details: 'Carry medication.',
    });
    act(() => {
      result.current.updateTitle('  Updated plan  ');
      result.current.updateDetails('  Updated details.  ');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(setYouthProfileNote).toHaveBeenCalledWith('youth-1', {
      category: 'health',
      title: 'Updated plan',
      details: 'Updated details.',
    }, 'note-1');
    expect(onSaved).toHaveBeenCalledWith(note);
  });

  it('submits a new note without an edit id', async () => {
    const { result } = renderHook(() => useProfileNoteModal({
      youthId: 'youth-1',
      onSaved: vi.fn(),
    }));

    act(() => result.current.updateTitle('Check in'));
    await act(async () => result.current.submit(submitEvent()));

    expect(setYouthProfileNote).toHaveBeenCalledWith('youth-1', {
      category: 'general',
      title: 'Check in',
      details: null,
    });
  });

  it('rejects a blank title before calling the API', async () => {
    const { result } = renderHook(() => useProfileNoteModal({
      youthId: 'youth-1',
      onSaved: vi.fn(),
    }));

    await act(async () => result.current.submit(submitEvent()));

    expect(setYouthProfileNote).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Enter a note title.');
  });

  it('preserves the draft when the same note record is recreated', () => {
    const options = { youthId: 'youth-1', note, onSaved: vi.fn() };
    const { result, rerender } = renderHook(
      (props: typeof options) => useProfileNoteModal(props),
      { initialProps: options },
    );

    act(() => result.current.updateTitle('Keep this draft'));
    rerender({ ...options, note: { ...note, details: 'Refreshed remotely.' } });

    expect(result.current.draft.title).toBe('Keep this draft');
  });

  it('reports a save failure and allows a retry', async () => {
    vi.mocked(setYouthProfileNote).mockRejectedValueOnce(new Error('Save failed'));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProfileNoteModal({
      youthId: 'youth-1',
      onSaved,
    }));
    act(() => result.current.updateTitle('Retry this note'));

    await act(async () => result.current.submit(submitEvent()));

    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Save failed');
    expect(onSaved).not.toHaveBeenCalled();

    vi.mocked(setYouthProfileNote).mockResolvedValue(note);
    await act(async () => result.current.submit(submitEvent()));

    expect(setYouthProfileNote).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith(note);
    expect(result.current.submitStatus).toBe('success');
  });

});
