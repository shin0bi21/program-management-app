import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import { useLeadPreferences } from './useLeadPreferences';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

const renderHook: typeof renderHookBase = (callback, options) => renderHookBase(callback, {
  ...options,
  wrapper: createQueryClientWrapper(createTestQueryClient()),
});

const programs: Program[] = [{
  id: 'program-1',
  name: 'Future Ready',
  description: null,
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  defaultDayOfWeek: 'tuesday',
  defaultStartTime: '17:00',
  defaultEndTime: '19:30',
  timezone: 'America/Toronto',
}];
const tableKeys = ['firstName', 'lastName', 'school', 'program', 'status', 'created'] as const;

describe('useLeadPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
  });

  it('maps search, filter, and table controls to external-lead preferences', async () => {
    const { result } = renderHook(() => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys)
    ));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.programIds).toEqual([]);

    act(() => result.current.search.setValue(' school '));
    act(() => result.current.search.apply());
    act(() => result.current.filters.apply('status', ['contacted']));
    act(() => result.current.filters.apply('submitterRole', ['youth']));
    act(() => {
      result.current.table.setHiddenColumns(['school']);
      result.current.table.setColumnWidths({ firstName: 240 });
      result.current.table.setSorting({ key: 'school', direction: 'asc' });
    });

    expect(JSON.parse(localStorage.getItem('table-layout:v1:user-1:outreach-external-leads-filters')!)).toEqual({
      hiddenColumns: ['school'], columnWidths: { firstName: 240 },
    });
    expect(result.current.search.appliedValue).toBe('school');
    expect(result.current.filters.statuses).toEqual(['contacted']);
    expect(result.current.filters.submitterRoles).toEqual(['youth']);
    expect(result.current.table).toMatchObject({
      sorting: { key: 'school', direction: 'asc' }, hiddenColumns: ['school'], columnWidths: { firstName: 240 },
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
      expect.objectContaining({ id: 'submitterRole' }),
    ]));
    expect(result.current.filters.submitterRoles).toEqual([]);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'outreach-internal-leads-filters', expect.objectContaining({ origins: ['internal'], submitterRoles: [] }),
    ));
  });

  it('validates lead statuses, submitter roles, origin, and legacy sorting', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      search: ' school ', statuses: ['contacted', 'obsolete'], programIds: ['program-1'],
      origins: ['internal'], submitterRoles: ['parent', 'obsolete'], hiddenColumns: 'school',
      sorting: { key: 'name', direction: 'asc' },
    });
    const { result } = renderHook(() => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys)
    ));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.search.value).toBe('school');
    expect(result.current.filters.statuses).toEqual(['contacted']);
    expect(result.current.filters.programIds).toEqual(['program-1']);
    expect(result.current.filters.submitterRoles).toEqual(['parent']);
    expect(result.current.table.hiddenColumns).toEqual([]);
    expect(result.current.table.sorting).toEqual({ key: 'created', direction: 'desc' });
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'outreach-external-leads-filters', expect.objectContaining({ origins: ['external'] }),
    ));
  });

  it('uses program availability without applying the local search draft', async () => {
    preferenceApi.getPreference.mockResolvedValue({ programIds: ['removed-program'] });
    const { result, rerender } = renderHook(({ error }: { error: string | null }) => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, error, tableKeys)
    ), { initialProps: { error: 'offline' as string | null } });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.programIds).toEqual(['removed-program']);

    act(() => result.current.filters.apply('status', ['contacted']));
    act(() => result.current.search.setValue('unfinished search'));
    rerender({ error: null });

    await waitFor(() => expect(result.current.filters.programIds).toEqual([]));
    expect(result.current.filters.statuses).toEqual(['contacted']);
    expect(result.current.search.value).toBe('unfinished search');
    expect(result.current.search.appliedValue).toBe('');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'outreach-external-leads-filters', expect.objectContaining({ programIds: [], statuses: ['contacted'], search: '' }),
    ));
  });
});
