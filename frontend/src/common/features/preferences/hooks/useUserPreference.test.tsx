import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPreference, setPreference } from '../preferences.api';
import useUserPreference from './useUserPreference';

vi.mock('../preferences.api', () => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

const getPreferenceMock = vi.mocked(getPreference);
const setPreferenceMock = vi.mocked(setPreference);

interface TestPreference {
  statuses: Array<'active' | 'inactive'>;
  programIds: string[];
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

const columnKeys = ['name', 'status'] as const;
const filters = (statuses: Array<'active' | 'inactive'>): TestPreference => ({
  statuses,
  programIds: [],
});
const useTestPreference = () => useUserPreference<TestPreference>(
  'youth-profile-filters',
  columnKeys,
);
let queryClient: QueryClient;
const createWrapper = () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useUserPreference', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getPreferenceMock.mockResolvedValue(null);
    setPreferenceMock.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('scrubs obsolete page column keys before exposing or saving a preference', async () => {
    getPreferenceMock.mockResolvedValue({
      ...filters([]),
      columnWidths: { name: 180, youthName: 260 },
      hiddenColumns: ['name', 'youthName'],
    });
    setPreferenceMock.mockImplementation(async (_key, value) => value);
    const { result } = renderHook(useTestPreference, { wrapper: createWrapper() });

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.preference).toEqual({
      ...filters([]),
      columnWidths: { name: 180 },
      hiddenColumns: ['name'],
    });

    act(() => result.current.save({
      ...filters(['active']),
      columnWidths: { name: 190, youthName: 270 },
      hiddenColumns: ['youthName'],
    }));
    await act(async () => vi.advanceTimersByTimeAsync(250));

    expect(setPreferenceMock).toHaveBeenCalledWith('youth-profile-filters', {
      ...filters(['active']),
      columnWidths: { name: 190 },
      hiddenColumns: [],
    });
  });

  it('debounces rapid changes and saves only the newest value', async () => {
    setPreferenceMock.mockImplementation(async (_key, value) => value);
    const { result } = renderHook(useTestPreference, { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    await act(async () => {
      result.current.save(filters(['active']));
      result.current.save(filters(['inactive']));
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(setPreferenceMock).toHaveBeenCalledTimes(1);
    expect(setPreferenceMock).toHaveBeenCalledWith('youth-profile-filters', filters(['inactive']));
  });

  it('applies consecutive functional updates to the latest optimistic value', async () => {
    getPreferenceMock.mockResolvedValue({ statuses: [], programIds: [] });
    setPreferenceMock.mockImplementation(async (_key, value) => value);
    const { result } = renderHook(useTestPreference, { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    await act(async () => {
      result.current.save(current => ({ ...(current ?? filters([])), statuses: ['active'] }));
      result.current.save(current => ({ ...(current ?? filters([])), programIds: ['program-1'] }));
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(queryClient.getQueryData(['user-preference', 'youth-profile-filters'])).toEqual({
      statuses: ['active'],
      programIds: ['program-1'],
    });
    expect(setPreferenceMock).toHaveBeenLastCalledWith('youth-profile-filters', {
      statuses: ['active'],
      programIds: ['program-1'],
    });
  });

  it('uses the page-normalized restoration baseline for the next control change', async () => {
    getPreferenceMock.mockResolvedValue({
      statuses: [],
      programIds: ['removed-program'],
    });
    setPreferenceMock.mockImplementation(async (_key, value) => value);
    const { result } = renderHook(useTestPreference, { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    act(() => {
      result.current.setBaseline({ statuses: [], programIds: [] });
      result.current.save(current => ({
        ...(current ?? filters([])),
        columnWidths: { name: 180 },
      }));
    });
    await act(async () => vi.advanceTimersByTimeAsync(250));

    expect(setPreferenceMock).toHaveBeenCalledWith('youth-profile-filters', {
      statuses: [],
      programIds: [],
      columnWidths: { name: 180 },
    });
  });

  it('queues the newest value while a save is in progress', async () => {
    let finishFirst!: (value: ReturnType<typeof filters>) => void;
    setPreferenceMock
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockImplementation(async (_key, value) => value);
    const { result } = renderHook(useTestPreference, { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    await act(async () => {
      result.current.save(filters(['active']));
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(setPreferenceMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.save(filters([]));
      result.current.save(filters(['inactive']));
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => finishFirst(filters(['active'])));

    expect(setPreferenceMock).toHaveBeenCalledTimes(2);
    expect(setPreferenceMock).toHaveBeenLastCalledWith('youth-profile-filters', filters(['inactive']));
  });

  it('keeps debouncing a new value even when the active save finishes', async () => {
    let finishFirst!: (value: ReturnType<typeof filters>) => void;
    setPreferenceMock
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockImplementation(async (_key, value) => value);
    const { result } = renderHook(useTestPreference, { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    await act(async () => {
      result.current.save(filters(['active']));
      await vi.advanceTimersByTimeAsync(250);
    });
    act(() => result.current.save(filters(['inactive'])));
    await act(async () => finishFirst(filters(['active'])));

    expect(setPreferenceMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(249); });
    expect(setPreferenceMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(setPreferenceMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a newer optimistic choice when an older save completes', async () => {
    let finishFirst!: (value: ReturnType<typeof filters>) => void;
    setPreferenceMock
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockImplementation(async (_key, value) => value);
    const { result } = renderHook(useTestPreference, { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    await act(async () => {
      result.current.save(filters(['active']));
      await vi.advanceTimersByTimeAsync(250);
    });
    act(() => result.current.save(filters(['inactive'])));
    await act(async () => finishFirst(filters(['active'])));

    expect(queryClient.getQueryData(['user-preference', 'youth-profile-filters'])).toEqual(filters(['inactive']));
  });

  it('flushes a pending preference when the page unmounts', async () => {
    setPreferenceMock.mockImplementation(async (_key, value) => value);
    const { result, unmount } = renderHook(useTestPreference, { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    act(() => result.current.save(filters(['inactive'])));
    unmount();
    await act(async () => Promise.resolve());

    expect(setPreferenceMock).toHaveBeenCalledWith('youth-profile-filters', filters(['inactive']));
  });
});
