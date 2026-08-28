// Owns useCohortControls state transitions and observable effects.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import { useCohortControls, type CohortPreference } from './useCohortControls';

const preferenceHook = vi.hoisted(() => ({
  preference: null as CohortPreference | null,
  loading: false,
  error: null as string | null,
  loadError: null as string | null,
  initializePreference: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const programs: Program[] = [{
  id: 'program-1',
  name: 'Soft Skills',
  description: null,
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
}];
const tableKeys = ['program', 'cohort', 'start', 'end', 'status'] as const;

describe('useCohortControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loadError = null;
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: CohortPreference = {
      programId: null,
      status: null,
      sorting: { key: 'start', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: CohortPreference) => CohortPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => (
      useCohortControls('admin', programs, false, tableKeys, null)
    ));
    await waitFor(() => expect(preferenceHook.initializePreference).toHaveBeenCalled());

    act(() => {
      result.current.setHiddenColumns(['status']);
      result.current.setColumnWidths({ cohort: 240 });
      result.current.setSorting({ key: 'program', direction: 'asc' });
    });

    expect(persisted.hiddenColumns).toEqual(['status']);
    expect(persisted.columnWidths).toEqual({ cohort: 240 });
    expect(persisted.sorting).toEqual({ key: 'program', direction: 'asc' });
  });

  it('uses role defaults when saved preferences cannot be loaded', async () => {
    preferenceHook.preference = { programId: 'program-1', status: 'completed' };
    preferenceHook.loadError = 'offline';
    const { result } = renderHook(() => useCohortControls('staff', programs, false, tableKeys, null));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.programId).toBe('program-1');
    expect(result.current.status).toBe('active');
  });

  it('scrubs removed programs and obsolete sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      programId: 'removed-program',
      status: 'active',
      sorting: { key: 'removedColumn' as never, direction: 'asc' },
    };
    const { result } = renderHook(() => (
      useCohortControls('admin', programs, false, tableKeys, null)
    ));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.programId).toBe('');
    expect(result.current.sorting).toEqual({ key: 'start', direction: 'desc' });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      programId: null,
      sorting: { key: 'start', direction: 'desc' },
    }));
  });
});
