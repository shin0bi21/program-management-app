import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteYouthProfileNote,
} from '../../youth.api';
import type { YouthProfileNote } from '../../types';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import useProfileNotes, { profileNotesQueryKey } from './useProfileNotes';

vi.mock('../../youth.api', () => ({
  deleteYouthProfileNote: vi.fn(),
}));

const note: YouthProfileNote = {
  id: 'note-1',
  youthId: 'youth-1',
  category: 'health',
  details: 'Allergy plan',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
};

describe('useProfileNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteYouthProfileNote).mockResolvedValue(undefined);
  });

  it('owns details, confirmation, deletion, and cache removal', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(profileNotesQueryKey('youth-1'), [note]);
    const { result } = renderHook(() => useProfileNotes('youth-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    act(() => result.current.requestDelete(note));
    expect(result.current.selectedNote).toBe(note);
    expect(result.current.confirmAction?.title).toBe('Delete Profile Note');

    await act(async () => result.current.confirmAction?.onConfirm());

    expect(deleteYouthProfileNote).toHaveBeenCalledWith('youth-1', 'note-1');
    expect(queryClient.getQueryData(profileNotesQueryKey('youth-1'))).toEqual([]);
    expect(result.current.selectedNote).toBeNull();
    expect(result.current.confirmAction).not.toBeNull();
    act(() => result.current.closeConfirmation());
    expect(result.current.confirmAction).toBeNull();
  });

  it('reconciles a saved edit without closing the editor before its success lifecycle completes', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(profileNotesQueryKey('youth-1'), [note]);
    const { result } = renderHook(() => useProfileNotes('youth-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    const savedNote = { ...note, details: 'Updated allergy plan' };
    act(() => result.current.openEditor(note));
    act(() => result.current.handleSaved(savedNote));

    expect(queryClient.getQueryData(profileNotesQueryKey('youth-1'))).toEqual([savedNote]);
    expect(result.current.editorTarget).toEqual({ youthId: 'youth-1', note });
    expect(result.current.selectedNote).toEqual(savedNote);

    act(() => result.current.closeEditor());

    expect(result.current.editorTarget).toBeNull();
    expect(result.current.selectedNote).toEqual(savedNote);
  });
});
