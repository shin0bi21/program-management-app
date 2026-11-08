import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import { makeProgramSession } from '../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { useYouthActions } from './useYouthActions';

/**
 * Mounts Youth actions with isolated queries and a selected-profile callback.
 * @example renderActions() // actions and query client for one test
 */
function renderActions() {
  const queryClient = createTestQueryClient();
  const onYouthSynced = vi.fn();
  const rendered = renderHook(() => useYouthActions(onYouthSynced), {
    wrapper: createQueryClientWrapper(queryClient),
  });
  return { ...rendered, queryClient, onYouthSynced };
}

describe('useYouthActions', () => {
  it('refreshes table queries and updates selected context after a save', () => {
    const rendered = renderActions();
    const saved = makeYouthProfile({ firstName: 'Updated' });
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries').mockResolvedValue();

    act(() => rendered.result.current.reconcileSavedYouth(saved));

    expect(rendered.onYouthSynced).toHaveBeenCalledWith(saved);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'table'] });
  });

  it('refreshes table queries after creation', () => {
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries').mockResolvedValue();

    act(() => rendered.result.current.reconcileCreatedYouth(makeYouthProfile({ id: 'youth-new' })));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'table'] });
    expect(rendered.onYouthSynced).not.toHaveBeenCalled();
  });

  it('refreshes affected session rosters and summaries after attendance changes', () => {
    const rendered = renderActions();
    const youth = makeYouthProfile();
    const session = makeProgramSession();
    const invalidate = vi.spyOn(rendered.queryClient, 'invalidateQueries').mockResolvedValue();

    act(() => rendered.result.current.reconcileAttendance({
      programCycle: { programId: 'program-1', cycleId: 'cycle-1', cycle: 'Summer', program: 'Skills', enrollmentRequired: true },
      sessions: [], youth, updatedSessions: [session],
    }));

    expect(rendered.onYouthSynced).toHaveBeenCalledWith(youth);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'table'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', 'table'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions', session.id, 'roster'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'cycle-assignments'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'attendance-summary', youth.id] });
  });
});
