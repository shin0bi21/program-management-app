import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { getPreference, setPreference, type PreferenceKey } from '../api/preferences.api';
import {
  normalizePreferences,
  preferenceOption,
  preferenceIds,
  preferenceText,
  preferenceOptions,
} from '../preferences';
import usePreferences from './usePreferences';

vi.mock('../api/preferences.api', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
const get = vi.mocked(getPreference);
const put = vi.mocked(setPreference);
const initial = { view: 'calendar', programIds: ['program-1'], statuses: [], search: '' };

function setup(options: { waiting?: boolean; available?: string[]; key?: PreferenceKey } = {}) {
  const client = createTestQueryClient();
  const hook = renderHook(({ waiting, available, key }: typeof options) => usePreferences({
    key: key ?? 'task-preferences',
    waiting,
    fields: {
      view: preferenceOption(['calendar', 'table'], 'calendar'),
      programIds: preferenceIds(available),
      statuses: preferenceOptions(['active', 'inactive']),
      search: preferenceText(),
    },
  }), { initialProps: options, wrapper: createQueryClientWrapper(client) });
  return { ...hook, client };
}

async function tick(ms = 1) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('usePreferences', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset().mockResolvedValue(initial);
    put.mockReset().mockImplementation(async (_key, value) => value);
  });
  afterEach(() => vi.useRealTimers());

  it('waits for initial dependencies and restores one normalized value', async () => {
    const { result, rerender } = setup({ waiting: true, available: undefined });
    await tick();
    expect(result.current.ready).toBe(false);
    rerender({ waiting: false, available: ['program-1'] });
    await tick();
    expect(result.current.ready).toBe(true);
    expect(result.current.preferences).toEqual(initial);
    await tick(250);
    expect(put).not.toHaveBeenCalled();
  });

  it('repairs and persists only invalid fields without reporting a load error', async () => {
    get.mockResolvedValue({ ...initial, view: 'removed', statuses: 'malformed', search: ' retained ' });
    const { result } = setup();
    await tick();
    expect(result.current.ready).toBe(true);
    await tick(250);
    expect(result.current.error).toBeNull();
    expect(result.current.preferences).toEqual({ ...initial, search: 'retained' });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('task-preferences', result.current.preferences);
  });

  it('uses defaults after a load failure and allows subsequent edits', async () => {
    get.mockRejectedValue(new Error('offline'));
    const { result } = setup();
    await tick(260);
    expect(result.current.ready).toBe(true);
    expect(result.current.loadError).toBe('offline');
    expect(put).not.toHaveBeenCalled();
    act(() => result.current.updatePreferences({ view: 'table' }));
    await tick(250);
    expect(result.current.preferences.view).toBe('table');
    expect(put).toHaveBeenCalledWith('task-preferences', expect.objectContaining({ view: 'table' }));
  });

  it('establishes missing defaults without writing until the user edits', async () => {
    get.mockResolvedValue(null);
    const { result } = setup();
    await tick(260);
    expect(result.current.ready).toBe(true);
    expect(put).not.toHaveBeenCalled();
    act(() => result.current.updatePreferences({ view: 'table' }));
    await tick(250);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('merges rapid patches against the latest value and debounces one save', async () => {
    const { result } = setup();
    await tick();
    act(() => {
      result.current.updatePreferences({ statuses: ['inactive'] });
      result.current.updatePreferences({ search: 'retained' });
      result.current.updatePreferences({ view: 'table' });
    });
    await tick(250);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('task-preferences', { ...initial, view: 'table', statuses: ['inactive'], search: 'retained' });
  });

  it('gives successive nested updates the latest cached preferences', async () => {
    get.mockResolvedValue({ filters: { search: 'saved', programIds: ['program-1'] } });
    const { result } = renderHook(() => usePreferences({
      key: 'task-preferences',
      fields: {
        filters: value => normalizePreferences({
          search: preferenceText(),
          programIds: preferenceIds(undefined),
        }, value),
      },
    }), { wrapper: createQueryClientWrapper(createTestQueryClient()) });
    await tick();

    act(() => {
      result.current.updatePreferences(current => ({ filters: { ...current.filters, search: 'updated' } }));
      result.current.updatePreferences(current => ({ filters: { ...current.filters, programIds: [] } }));
    });

    await tick(250);
    expect(put).toHaveBeenCalledExactlyOnceWith('task-preferences', {
      filters: { search: 'updated', programIds: [] },
    });
  });

  it('reconciles the latest selection when options recover and preserves sibling edits', async () => {
    get.mockResolvedValue({ ...initial, programIds: ['program-1', 'removed'] });
    const { result, rerender } = setup({ available: undefined });
    await tick();
    expect(result.current.preferences.programIds).toEqual(['program-1', 'removed']);
    act(() => result.current.updatePreferences({ view: 'table' }));
    rerender({ available: ['program-1'] });
    await tick(260);
    expect(put).toHaveBeenLastCalledWith('task-preferences', { ...initial, view: 'table' });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('does not restore an old selection after the user clears it during an option outage', async () => {
    const { result, rerender } = setup({ available: undefined });
    await tick();
    act(() => result.current.updatePreferences({ programIds: [] }));
    rerender({ available: ['program-1'] });
    await tick(260);
    expect(result.current.preferences.programIds).toEqual([]);
    expect(put).toHaveBeenLastCalledWith('task-preferences', { ...initial, programIds: [] });
  });

  it('cleans a selection deleted during the page visit after options refresh', async () => {
    const { result, rerender } = setup({ available: ['program-1'] });
    await tick();
    rerender({ available: [] });
    await tick(260);
    expect(result.current.preferences.programIds).toEqual([]);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('serializes saves while retaining the newest queued update', async () => {
    let finish!: (value: object) => void;
    put.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = setup();
    await tick();
    act(() => result.current.updatePreferences({ view: 'table' }));
    await tick(250);
    act(() => result.current.updatePreferences({ statuses: ['active'] }));
    await tick(250);
    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => finish(initial));
    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenLastCalledWith('task-preferences', { ...initial, view: 'table', statuses: ['active'] });
  });

  it('does not shorten the debounce when an earlier save finishes', async () => {
    let finish!: (value: object) => void;
    put.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = setup();
    await tick();
    act(() => result.current.updatePreferences({ view: 'table' }));
    await tick(250);
    act(() => result.current.updatePreferences({ statuses: ['active'] }));
    await act(async () => finish(initial));
    await tick(249);
    expect(put).toHaveBeenCalledTimes(1);
    await tick();
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('ignores an obsolete save failure and reports a failure of the latest edit', async () => {
    let fail!: (error: Error) => void;
    put.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    const { result } = setup();
    await tick();
    act(() => result.current.updatePreferences({ view: 'table' }));
    await tick(250);
    act(() => result.current.updatePreferences({ statuses: ['active'] }));
    await act(async () => fail(new Error('obsolete')));
    expect(result.current.saveError).toBeNull();
    put.mockRejectedValueOnce(new Error('offline'));
    await tick(250);
    expect(result.current.saveError).toBe('offline');
    act(() => result.current.updatePreferences({ statuses: [] }));
    await tick(250);
    expect(result.current.saveError).toBeNull();
  });

  it('cancels an old load before an edit and never replaces that edit with the response', async () => {
    let finish!: (value: unknown) => void;
    get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = setup();
    act(() => result.current.updatePreferences({ view: 'table' }));
    await act(async () => finish(initial));
    await tick(260);
    expect(result.current.preferences.view).toBe('table');
  });

  it('flushes a debounced edit on unmount', async () => {
    const { result, unmount } = setup();
    await tick();
    act(() => result.current.updatePreferences({ view: 'table' }));
    unmount();
    expect(put).toHaveBeenCalledWith('task-preferences', { ...initial, view: 'table' });
  });

  it('keeps pending saves and current values isolated when the preference key changes', async () => {
    get.mockImplementation(async key => key === 'task-preferences' ? initial : { ...initial, programIds: [] });
    const { result, rerender } = setup({ key: 'task-preferences' });
    await tick();
    act(() => result.current.updatePreferences({ view: 'table' }));
    rerender({ key: 'hours-filters' });
    await tick();
    expect(put).toHaveBeenCalledWith('task-preferences', { ...initial, view: 'table' });
    expect(result.current.preferences).toEqual({ ...initial, programIds: [] });
    act(() => result.current.updatePreferences({ statuses: ['active'] }));
    await tick(250);
    expect(put).toHaveBeenLastCalledWith('hours-filters', { ...initial, programIds: [], statuses: ['active'] });
  });

  it('keeps the current save error when a previous key fails later', async () => {
    let failPrevious!: (error: Error) => void;
    put.mockImplementationOnce(() => new Promise((_resolve, reject) => { failPrevious = reject; }));
    const { result, rerender } = setup({ key: 'task-preferences' });
    await tick();
    act(() => result.current.updatePreferences({ view: 'table' }));
    await tick(250);

    rerender({ key: 'hours-filters' });
    await tick();
    put.mockRejectedValueOnce(new Error('Current save failed'));
    act(() => result.current.updatePreferences({ view: 'table' }));
    await tick(250);
    expect(result.current.saveError).toBe('Current save failed');

    await act(async () => failPrevious(new Error('Previous save failed')));
    expect(result.current.saveError).toBe('Current save failed');
  });

});
