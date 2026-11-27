import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setYouthProfileNote } from '../../../youth.api';
import type { YouthProfileNote } from '../../../types';
import useProfileNoteModal from './useProfileNoteModal';

vi.mock('../../../youth.api', () => ({
  setYouthProfileNote: vi.fn(),
}));

const note: YouthProfileNote = {
  id: 'note-1',
  youthId: 'youth-1',
  category: 'health',
  details: 'Allergy plan: carry medication.',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
};

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
      details: 'Allergy plan: carry medication.',
    });
    act(() => {
      result.current.setValue('details', '  Updated details.  ');
    });
    await act(async () => result.current.submit());

    expect(setYouthProfileNote).toHaveBeenCalledWith('youth-1', {
      category: 'health',
      details: 'Updated details.',
    }, 'note-1');
    expect(onSaved).toHaveBeenCalledWith(note);
  });

  it('submits a new note without an edit id', async () => {
    const { result } = renderHook(() => useProfileNoteModal({
      youthId: 'youth-1',
      onSaved: vi.fn(),
    }));

    act(() => { result.current.setValue('details', 'Check in'); result.current.selectCategory('general'); });
    await act(async () => result.current.submit());

    expect(setYouthProfileNote).toHaveBeenCalledWith('youth-1', {
      category: 'general',
      details: 'Check in',
    });
  });

  it('rejects a blank note before calling the API', async () => {
    const { result } = renderHook(() => useProfileNoteModal({
      youthId: 'youth-1',
      onSaved: vi.fn(),
    }));

    await act(async () => result.current.submit());

    expect(setYouthProfileNote).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Enter a note.');
  });

  it('reports a save failure and allows a retry', async () => {
    vi.mocked(setYouthProfileNote).mockRejectedValueOnce(new Error('Save failed'));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProfileNoteModal({
      youthId: 'youth-1',
      onSaved,
    }));
    act(() => { result.current.setValue('details', 'Retry this note'); result.current.selectCategory('general'); });

    await act(async () => result.current.submit());

    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Save failed');
    expect(onSaved).not.toHaveBeenCalled();

    vi.mocked(setYouthProfileNote).mockResolvedValue(note);
    await act(async () => result.current.submit());

    expect(setYouthProfileNote).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith(note);
    expect(result.current.submitStatus).toBe('success');
  });

});
