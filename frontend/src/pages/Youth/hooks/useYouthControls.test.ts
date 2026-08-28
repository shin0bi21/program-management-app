// Owns useYouthControls state transitions and observable effects.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../common/features/programs/types';
import { useYouthControls, type YouthPreference } from './useYouthControls';

const preferenceHook = vi.hoisted<{
  preference: YouthPreference | null;
  loading: boolean;
  error: string | null;
  loadError: string | null;
  initializePreference: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({
  preference: null,
  loading: false,
  error: null,
  loadError: null,
  initializePreference: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({
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
const tableKeys = ['firstName', 'lastName', 'age', 'school', 'grade', 'program', 'status'] as const;

describe('useYouthControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.loadError = null;
  });

  it('waits for the authenticated role before applying staff defaults', async () => {
    const { result, rerender } = renderHook(
      ({ role }: { role: string | null }) => useYouthControls({
        role,
        programs,
        programsLoading: false,
        tableKeys,
      }),
      { initialProps: { role: null as string | null } },
    );

    expect(result.current.queryFilters).toBeNull();

    rerender({ role: 'staff' });

    await waitFor(() => expect(result.current.queryFilters).toEqual({
      search: '',
      statuses: ['active'],
      programIds: ['program-1'],
    }));
  });

  it('uses role defaults when saved preferences cannot be loaded', async () => {
    preferenceHook.preference = { statuses: ['inactive'], programIds: [] } as YouthPreference;
    preferenceHook.loadError = 'offline';
    const { result } = renderHook(() => useYouthControls({ role: 'staff', programs, programsLoading: false, tableKeys }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.statusFilters).toEqual(['active']);
    expect(result.current.programFilters).toEqual(['program-1']);
  });

  it('uses the option-scrubbed preference as the shared save baseline', async () => {
    preferenceHook.preference = {
      statuses: ['active'],
      programIds: ['removed-program'],
      sorting: { key: 'firstName', direction: 'asc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    const { result } = renderHook(() => useYouthControls({
      role: 'staff',
      programs,
      programsLoading: false,
      tableKeys,
    }));

    await waitFor(() => expect(result.current.queryFilters?.programIds).toEqual([]));
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith({
      statuses: ['active'],
      programIds: [],
      sorting: { key: 'firstName', direction: 'asc' },
      columnWidths: {},
      hiddenColumns: [],
    });
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: YouthPreference = {
      statuses: ['active'],
      programIds: ['program-1'],
      sorting: { key: 'firstName', direction: 'asc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: YouthPreference) => YouthPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'staff',
      programs,
      programsLoading: false,
      tableKeys,
    }));
    await waitFor(() => expect(result.current.queryFilters).not.toBeNull());

    act(() => {
      result.current.setHiddenColumns(['school']);
      result.current.setColumnWidths({ firstName: 240 });
    });

    expect(persisted.hiddenColumns).toEqual(['school']);
    expect(persisted.columnWidths).toEqual({ firstName: 240 });
  });

  it('replaces an obsolete saved sort key in the canonical baseline', async () => {
    preferenceHook.preference = {
      statuses: ['active'],
      programIds: ['program-1'],
      sorting: { key: 'removedColumn' as never, direction: 'desc' },
    };
    const { result } = renderHook(() => useYouthControls({
      role: 'staff', programs, programsLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.sorting).toEqual({ key: 'firstName', direction: 'asc' });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      sorting: { key: 'firstName', direction: 'asc' },
    }));
  });

  it('scrubs malformed status and column-width preferences', async () => {
    preferenceHook.preference = {
      statuses: 'active' as never,
      programIds: [],
      columnWidths: { firstName: 220, status: 'wide' } as never,
    };
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.statusFilters).toEqual([]);
    expect(result.current.columnWidths).toEqual({ firstName: 220 });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      statuses: [],
      columnWidths: { firstName: 220 },
    }));
  });
});
