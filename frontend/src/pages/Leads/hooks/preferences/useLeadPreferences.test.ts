// Owns useLeadPreferences state transitions and observable effects.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import { useLeadPreferences, type LeadPreference } from './useLeadPreferences';

const preferenceHook = vi.hoisted(() => ({
  preference: null as LeadPreference | null,
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
  name: 'Future Ready',
  description: null,
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
}];
const tableKeys = ['firstName', 'lastName', 'school', 'program', 'status', 'created'] as const;

describe('useLeadPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loadError = null;
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: LeadPreference = {
      search: '',
      statuses: [],
      programIds: [],
      origins: [],
      submitterRoles: [],
      sorting: { key: 'created', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: LeadPreference) => LeadPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.table.setHiddenColumns(['school']);
      result.current.table.setColumnWidths({ firstName: 240 });
      result.current.table.setSorting({ key: 'school', direction: 'asc' });
    });

    expect(persisted.hiddenColumns).toEqual(['school']);
    expect(persisted.columnWidths).toEqual({ firstName: 240 });
    expect(persisted.sorting).toEqual({ key: 'school', direction: 'asc' });
  });

  it('uses defaults when saved preferences cannot be loaded', async () => {
    preferenceHook.preference = { search: '', statuses: ['contacted'], programIds: ['program-1'], origins: ['external'], submitterRoles: ['parent'] };
    preferenceHook.loadError = 'offline';
    const { result } = renderHook(() => useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.programIds).toEqual([]);
  });

  it('scrubs removed programs and resets legacy name sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      search: '',
      statuses: ['new'],
      programIds: ['removed-program'],
      origins: [],
      submitterRoles: ['parent'],
      sorting: { key: 'name' as never, direction: 'asc' },
    };
    const { result } = renderHook(() => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys)
    ));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.programIds).toEqual([]);
    expect(result.current.table.sorting).toEqual({ key: 'created', direction: 'desc' });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      programIds: [],
      sorting: { key: 'created', direction: 'desc' },
    }));
  });

  it('exposes search, filters, and table through the standard preference contract', async () => {
    const persisted: LeadPreference = {
      search: '',
      statuses: [],
      programIds: [],
      origins: ['external'],
      submitterRoles: [],
      sorting: { key: 'created', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: LeadPreference) => LeadPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => (
      useLeadPreferences('external', 'outreach-external-leads-filters', programs, false, null, tableKeys)
    ));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.search.setValue(' school '));
    act(() => result.current.search.apply());
    act(() => result.current.filters.apply('status', ['contacted']));
    act(() => result.current.filters.apply('submitterRole', ['youth']));

    expect(result.current.search.appliedValue).toBe('school');
    expect(result.current.filters.statuses).toEqual(['contacted']);
    expect(result.current.filters.submitterRoles).toEqual(['youth']);
    expect(result.current.table.sorting).toEqual({ key: 'created', direction: 'desc' });
    expect(persisted).toEqual(expect.objectContaining({ search: 'school', statuses: ['contacted'], submitterRoles: ['youth'] }));
  });

  it('omits the submitter filter from internal lead controls and requests', async () => {
    const { result } = renderHook(() => (
      useLeadPreferences('internal', 'outreach-internal-leads-filters', programs, false, null, tableKeys)
    ));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.definitions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'submitterRole' }),
    ]));
    expect(result.current.filters.submitterRoles).toEqual([]);
  });
});
