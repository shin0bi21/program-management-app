// Owns useProfileNotes state transitions and observable effects.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteYouthProfileNote,
  getYouthProfileNotes,
} from '../../../../common/features/youth/youth.api';
import type { YouthProfileNote } from '../../../../common/types/youth';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import useProfileNotes from './useProfileNotes';

vi.mock('../../../../common/features/youth/youth.api', () => ({
  deleteYouthProfileNote: vi.fn(),
  getYouthProfileNotes: vi.fn(),
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
    vi.mocked(getYouthProfileNotes).mockResolvedValue([note]);
    vi.mocked(deleteYouthProfileNote).mockResolvedValue(undefined);
  });

  it('owns details, confirmation, deletion, and cache removal', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useProfileNotes('youth-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.notes).toEqual([note]));

    act(() => result.current.requestDelete(note));
    expect(result.current.selectedNote).toBe(note);
    expect(result.current.confirmingDelete).toBe(true);

    await act(async () => result.current.confirmDelete());

    expect(deleteYouthProfileNote).toHaveBeenCalledWith('youth-1', 'note-1');
    expect(result.current.notes).toEqual([]);
    expect(result.current.selectedNote).toBeNull();
    expect(result.current.confirmingDelete).toBe(false);
  });

  it('clears stale modal state when the selected youth changes', async () => {
    const queryClient = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ youthId }: { youthId: string | null }) => useProfileNotes(youthId),
      {
        initialProps: { youthId: 'youth-1' },
        wrapper: createQueryClientWrapper(queryClient),
      },
    );
    await waitFor(() => expect(result.current.notes).toEqual([note]));
    act(() => {
      result.current.openDetails(note);
      result.current.openEditor(note);
    });

    rerender({ youthId: 'youth-2' });

    await waitFor(() => {
      expect(result.current.selectedNote).toBeNull();
      expect(result.current.editorTarget).toBeNull();
    });
  });

  it('reconciles a saved edit without closing the editor before its success lifecycle completes', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useProfileNotes('youth-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.notes).toEqual([note]));

    const savedNote = { ...note, details: 'Updated allergy plan' };
    act(() => result.current.openEditor(note));
    act(() => result.current.handleSaved(savedNote));

    expect(result.current.notes).toEqual([savedNote]);
    expect(result.current.editorTarget).toEqual({ youthId: 'youth-1', note });
    expect(result.current.selectedNote).toEqual(savedNote);

    act(() => result.current.closeEditor());

    expect(result.current.editorTarget).toBeNull();
    expect(result.current.selectedNote).toEqual(savedNote);
  });
});
