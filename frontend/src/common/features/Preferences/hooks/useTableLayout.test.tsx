import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { clearAuthData, setAuthData } from '../../../../auth/storage';
import { getPreference, setPreference, type PreferenceKey } from '../api/preferences.api';
import useTableLayout from './useTableLayout';

vi.mock('../api/preferences.api', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));

const defaults = { columnWidths: {}, hiddenColumns: [] };
/**
 * Builds the layout storage key for a test user and table.
 * @example storageKey() // 'table-layout:v1:user-1:task-preferences'
 */
const storageKey = (user = 'user-1', key: PreferenceKey = 'task-preferences') => `table-layout:v1:${user}:${key}`;

/**
 * Stores a signed-in test identity for layout isolation.
 * @example login('user-2') selects user-2's local layouts.
 */
function login(id = 'user-1') {
  setAuthData('token', { id, firstName: 'Test', lastName: 'User', email: 'test@example.com' });
}

/**
 * Mounts the layout hook with an isolated query cache and the supplied table scope.
 * @example setup() restores the default user's task layout.
 */
function setup(options: { key: PreferenceKey; tableKeys: readonly string[] } = {
  key: 'task-preferences', tableKeys: ['name', 'status'],
}) {
  const client = createTestQueryClient();
  const hook = renderHook(props => useTableLayout(props), {
    initialProps: options,
    wrapper: createQueryClientWrapper(client),
  });
  return { ...hook, client };
}

describe('useTableLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    login();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('restores local widths and visibility after remount with a new session cache', async () => {
    const first = setup();
    expect(first.result.current).toMatchObject(defaults);
    expect(localStorage.getItem(storageKey())).toBeNull();

    act(() => {
      first.result.current.setColumnWidths({ name: 180 });
      first.result.current.setHiddenColumns(['status']);
    });
    await waitFor(() => expect(first.result.current).toMatchObject({ columnWidths: { name: 180 }, hiddenColumns: ['status'] }));
    first.unmount();

    const restored = setup();
    expect(restored.result.current).toMatchObject({ columnWidths: { name: 180 }, hiddenColumns: ['status'] });
    expect(getPreference).not.toHaveBeenCalled();
    expect(setPreference).not.toHaveBeenCalled();
  });

  it('keeps users and tables isolated when the active scope changes', async () => {
    const { result, rerender } = setup();
    act(() => result.current.setColumnWidths({ name: 180 }));
    await waitFor(() => expect(result.current.columnWidths).toEqual({ name: 180 }));

    rerender({ key: 'hours-filters', tableKeys: ['name', 'status'] });
    expect(result.current).toMatchObject(defaults);
    act(() => result.current.setHiddenColumns(['name']));
    await waitFor(() => expect(result.current.hiddenColumns).toEqual(['name']));

    login('user-2');
    rerender({ key: 'task-preferences', tableKeys: ['name', 'status'] });
    expect(result.current).toMatchObject(defaults);
    act(() => result.current.setColumnWidths({ name: 320 }));
    await waitFor(() => expect(result.current.columnWidths).toEqual({ name: 320 }));

    login();
    rerender({ key: 'task-preferences', tableKeys: ['name', 'status'] });
    expect(result.current).toMatchObject({ columnWidths: { name: 180 }, hiddenColumns: [] });
    expect(JSON.parse(localStorage.getItem(storageKey('user-1', 'hours-filters'))!)).toEqual({ columnWidths: {}, hiddenColumns: ['name'] });
    expect(JSON.parse(localStorage.getItem(storageKey('user-2'))!)).toEqual({ columnWidths: { name: 320 }, hiddenColumns: [] });
  });

  it('preserves a user layout through logout and login', async () => {
    const first = setup();
    act(() => first.result.current.setHiddenColumns(['status']));
    await waitFor(() => expect(first.result.current.hiddenColumns).toEqual(['status']));
    first.unmount();
    clearAuthData();
    first.client.clear();

    login();
    const restored = setup();
    expect(restored.result.current.hiddenColumns).toEqual(['status']);
  });

  it('normalizes malformed fields and obsolete columns while preserving valid siblings', async () => {
    localStorage.setItem(storageKey(), JSON.stringify({
      columnWidths: { name: 180, status: -1, removed: 200 }, hiddenColumns: ['status', 'removed', 42],
    }));
    const { result, rerender } = setup();
    expect(result.current).toMatchObject({ columnWidths: { name: 180 }, hiddenColumns: ['status'] });

    act(() => result.current.setColumnWidths({ name: Infinity, status: 220, removed: 100 }));
    await waitFor(() => expect(result.current.columnWidths).toEqual({ status: 220 }));
    expect(JSON.parse(localStorage.getItem(storageKey())!)).toEqual({ columnWidths: { status: 220 }, hiddenColumns: ['status'] });

    rerender({ key: 'task-preferences', tableKeys: ['name'] });
    expect(result.current).toMatchObject(defaults);
  });

  it.each(['not-json', 'null', '[]', '{"columnWidths":"wide","hiddenColumns":"name"}'])(
    'uses defaults for malformed stored layout %s', stored => {
      localStorage.setItem(storageKey(), stored);
      const { result } = setup();
      expect(result.current).toMatchObject(defaults);
    },
  );

  it('keeps edits usable in memory when writes are unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    const { result } = setup();

    act(() => {
      result.current.setColumnWidths({ name: 180 });
      result.current.setHiddenColumns(['status']);
    });
    await waitFor(() => expect(result.current).toMatchObject({ columnWidths: { name: 180 }, hiddenColumns: ['status'] }));
    expect(localStorage.getItem(storageKey())).toBeNull();
    expect(setPreference).not.toHaveBeenCalled();
  });

  it('keeps edits usable when storage reads are blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const { result } = setup();
    expect(result.current).toMatchObject(defaults);

    act(() => result.current.setHiddenColumns(['status']));
    await waitFor(() => expect(result.current.hiddenColumns).toEqual(['status']));
    expect(setPreference).not.toHaveBeenCalled();
  });

  it('updates from another tab and resets when that tab clears storage', async () => {
    const { result } = setup();
    const layout = { columnWidths: { name: 240 }, hiddenColumns: ['status'] };
    act(() => {
      localStorage.setItem(storageKey(), JSON.stringify(layout));
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey() }));
    });
    await waitFor(() => expect(result.current).toMatchObject(layout));

    act(() => {
      localStorage.removeItem(storageKey());
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    await waitFor(() => expect(result.current).toMatchObject(defaults));
  });
});
