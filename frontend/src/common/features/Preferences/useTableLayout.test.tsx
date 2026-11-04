import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../tests/queryClientTestUtils';
import { clearAuthData, setAuthData } from '../../../auth/storage';
import { getPreference, setPreference, type PreferenceKey } from './preferences.api';
import useTableLayout from './useTableLayout';

vi.mock('./preferences.api', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));

const defaults = { columnWidths: {}, hiddenColumns: [] };
const storageKey = (user = 'user-1', key: PreferenceKey = 'task-preferences') => `table-layout:v1:${user}:${key}`;

function login(id = 'user-1') {
  setAuthData('token', { id, firstName: 'Test', lastName: 'User', email: 'test@example.com' });
}

function setup(options: { key: PreferenceKey; tableKeys: readonly string[]; columnKeyAliases?: Readonly<Record<string, string>> } = {
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

  it.each([false, true])('migrates renamed column keys while preserving existing current values (current width: %s)', currentWidth => {
    localStorage.setItem(storageKey(), JSON.stringify({
      columnWidths: { cohort: 240, name: 180, ...(currentWidth ? { cycle: 320 } : {}) },
      hiddenColumns: ['cohort', 'cycle', 'name'],
    }));
    const options = { key: 'task-preferences' as const, tableKeys: ['name', 'cycle'], columnKeyAliases: { cohort: 'cycle' } };
    const first = setup(options);
    const expected = { columnWidths: { name: 180, cycle: currentWidth ? 320 : 240 }, hiddenColumns: ['cycle', 'name'] };

    expect(first.result.current).toMatchObject(expected);
    expect(JSON.parse(localStorage.getItem(storageKey())!)).toEqual(expected);
    first.unmount();
    expect(setup(options).result.current).toMatchObject(expected);
    expect(setPreference).not.toHaveBeenCalled();
  });

  it('restores renamed columns even when the migration cannot be saved to storage', () => {
    localStorage.setItem(storageKey(), JSON.stringify({ columnWidths: { cohort: 240 }, hiddenColumns: ['cohort'] }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    const { result } = setup({ key: 'task-preferences', tableKeys: ['cycle'], columnKeyAliases: { cohort: 'cycle' } });

    expect(result.current).toMatchObject({ columnWidths: { cycle: 240 }, hiddenColumns: ['cycle'] });
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

  it('gives independent browser storage independent layouts for the same account', async () => {
    const desktop = setup();
    act(() => desktop.result.current.setColumnWidths({ name: 320 }));
    await waitFor(() => expect(desktop.result.current.columnWidths).toEqual({ name: 320 }));
    const desktopStorage = localStorage.getItem(storageKey())!;
    desktop.unmount();

    // A fresh origin storage area represents the second browser/device.
    localStorage.clear();
    login();
    const mobile = setup();
    expect(mobile.result.current).toMatchObject(defaults);
    act(() => {
      mobile.result.current.setColumnWidths({ name: 120 });
      mobile.result.current.setHiddenColumns(['status']);
    });
    await waitFor(() => expect(mobile.result.current).toMatchObject({ columnWidths: { name: 120 }, hiddenColumns: ['status'] }));
    mobile.unmount();

    localStorage.setItem(storageKey(), desktopStorage);
    const desktopAgain = setup();
    expect(desktopAgain.result.current).toMatchObject({ columnWidths: { name: 320 }, hiddenColumns: [] });
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
