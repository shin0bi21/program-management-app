import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
import { useLeadPreferences } from './useLeadPreferences';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

/**
 * Mounts the supplied hook with an isolated preference query cache.
 * @param callback - Hook rendered for this scenario.
 * @param options - Initial props and rendering options.
 * @example renderHook(() => usePreferences()) restores controls in a fresh cache.
 */
const renderHook: typeof renderHookBase = (callback, options) => renderHookBase(callback, {
  ...options,
  wrapper: createQueryClientWrapper(createTestQueryClient()),
});

const programs: ProgramReference[] = [{ id: 'program-1', title: 'Future Ready' }];
const tableKeys = ['firstName', 'lastName', 'school', 'program', 'status', 'created'] as const;

describe('useLeadPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
  });

  it('maps search, filters, and sorting to external-lead preferences', async () => {
    const { result } = renderHook(() => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys)
    ));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.appliedFilters.statuses).toEqual([]);
    expect(result.current.appliedFilters.programIds).toEqual([]);

    act(() => result.current.search.apply(' school '));
    act(() => result.current.filters.apply('statuses', ['contacted']));
    act(() => result.current.filters.apply('submitterRoles', ['youth']));
    act(() => {
      result.current.table.setSorting({ key: 'school', direction: 'asc' });
    });

    expect(result.current.appliedFilters.search).toBe('school');
    expect(result.current.appliedFilters.statuses).toEqual(['contacted']);
    expect(result.current.appliedFilters.submitterRoles).toEqual(['youth']);
    expect(result.current.table).toMatchObject({
      sorting: { key: 'school', direction: 'asc' },
    });
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'outreach-external-leads-filters', expect.objectContaining({
        search: 'school', statuses: ['contacted'], submitterRoles: ['youth'],
        sorting: { key: 'school', direction: 'asc' },
      }),
    ));
  });

  it('restricts internal leads to their origin and removes saved submitter roles', async () => {
    preferenceApi.getPreference.mockResolvedValue({ origins: ['external'], submitterRoles: ['parent'] });
    const { result } = renderHook(() => (
      useLeadPreferences('internal', 'outreach-internal-leads-filters', programs, false, null, tableKeys)
    ));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.definitions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'submitterRoles' }),
    ]));
    expect(result.current.appliedFilters.submitterRoles).toEqual([]);
    expect(result.current.appliedFilters.origins).toEqual(['internal']);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'outreach-internal-leads-filters', expect.objectContaining({ origins: ['internal'], submitterRoles: [] }),
    ));
  });

  it('restores external lead statuses and submitter roles with the external origin', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      search: 'school', statuses: ['contacted'], programIds: ['program-1'],
      origins: ['internal'], submitterRoles: ['parent'],
    });
    const { result } = renderHook(() => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys)
    ));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.appliedFilters.search).toBe('school');
    expect(result.current.appliedFilters.statuses).toEqual(['contacted']);
    expect(result.current.appliedFilters.programIds).toEqual(['program-1']);
    expect(result.current.appliedFilters.submitterRoles).toEqual(['parent']);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'outreach-external-leads-filters', expect.objectContaining({ origins: ['external'] }),
    ));
  });

  it('repairs program availability while preserving applied controls', async () => {
    preferenceApi.getPreference.mockResolvedValue({ programIds: ['removed-program'] });
    const { result, rerender } = renderHook(({ error }: { error: string | null }) => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, error, tableKeys)
    ), { initialProps: { error: 'offline' as string | null } });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.programIds).toEqual(['removed-program']);

    act(() => result.current.filters.apply('statuses', ['contacted']));
    rerender({ error: null });

    await waitFor(() => expect(result.current.appliedFilters.programIds).toEqual([]));
    expect(result.current.appliedFilters.statuses).toEqual(['contacted']);
    expect(result.current.appliedFilters.search).toBe('');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'outreach-external-leads-filters', expect.objectContaining({ programIds: [], statuses: ['contacted'], search: '' }),
    ));
  });
});
