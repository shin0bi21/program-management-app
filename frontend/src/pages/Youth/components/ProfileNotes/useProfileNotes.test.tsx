// Scope: verifies profile-note selection, deletion, cache updates, and youth changes.
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
  title: 'Allergy plan',
  details: null,
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

});
