import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
import { useCohortControls } from './useCohortControls';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

const programs: ProgramReference[] = [{ id: 'program-1', name: 'Soft Skills' }];
const tableKeys = ['program', 'cohort', 'start', 'end', 'status'] as const;

describe('useCohortControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation(async (_key: string, value: object) => value);
  });
  const wrapper = () => createQueryClientWrapper(createTestQueryClient());

  it('uses the staff active-status default when saved preferences cannot be loaded', async () => {
    preferenceApi.getPreference.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCohortControls('staff', programs, false, tableKeys, null), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.programId).toBe('');
    expect(result.current.filters.status).toBe('active');
  });

  it('repairs stale cohort preferences and saves table control changes', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      programId: 'removed-program',
      status: 'active',
      sorting: { key: 'removedColumn' as never, direction: 'asc' },
    });
    const { result } = renderHook(() => (
      useCohortControls('admin', programs, false, tableKeys, null)
    ), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.programId).toBe('');
    expect(result.current.table.sorting).toEqual({ key: 'start', direction: 'desc' });

    act(() => {
      result.current.table.setHiddenColumns(['status']);
      result.current.table.setColumnWidths({ cohort: 240 });
      result.current.table.setSorting({ key: 'program', direction: 'asc' });
    });

    expect(result.current.table.hiddenColumns).toEqual(['status']);
    expect(result.current.table.columnWidths).toEqual({ cohort: 240 });
    expect(JSON.parse(localStorage.getItem('table-layout:v1:user-1:cohort-filters')!)).toEqual({
      hiddenColumns: ['status'], columnWidths: { cohort: 240 },
    });
    expect(result.current.table.sorting).toEqual({ key: 'program', direction: 'asc' });
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith('cohort-filters', {
      programId: null,
      status: 'active',
      sorting: { key: 'program', direction: 'asc' },
    }));
  });

  it('preserves an intentionally cleared staff status after restoration', async () => {
    preferenceApi.getPreference.mockResolvedValue({ status: null });
    const { result } = renderHook(() => useCohortControls('staff', programs, false, tableKeys), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.status).toBe('');
  });

  it('repairs a removed program after options recover and preserves the chosen status', async () => {
    preferenceApi.getPreference.mockResolvedValue({ programId: 'removed', status: 'completed' });
    const { result, rerender } = renderHook(({ error }) => useCohortControls('admin', programs, false, tableKeys, error), {
      wrapper: wrapper(), initialProps: { error: 'offline' as string | null },
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.programId).toBe('removed');

    act(() => result.current.filters.apply('status', ['upcoming']));
    rerender({ error: null });

    await waitFor(() => expect(result.current.filters.programId).toBe(''));
    expect(result.current.filters.status).toBe('upcoming');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith('cohort-filters', expect.objectContaining({
      programId: null, status: 'upcoming',
    })));
  });
});
