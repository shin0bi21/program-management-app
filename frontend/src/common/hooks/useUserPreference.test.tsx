import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPreference, setPreference } from '../api/preferences.api';
import useUserPreference from './useUserPreference';

vi.mock('../api/preferences.api', () => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

const getPreferenceMock = vi.mocked(getPreference);
const setPreferenceMock = vi.mocked(setPreference);
const filters = (statuses: Array<'active' | 'inactive'>) => ({ statuses, programIds: [] });
const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

  it('debounces rapid changes and saves only the newest value', async () => {
    setPreferenceMock.mockImplementation(async (_key, value) => value);
    const { result } = renderHook(() => useUserPreference('youth-profile-filters'), { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    await act(async () => {
      result.current.save(filters(['active']));
      result.current.save(filters(['inactive']));
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(setPreferenceMock).toHaveBeenCalledTimes(1);
    expect(setPreferenceMock).toHaveBeenCalledWith('youth-profile-filters', filters(['inactive']));
  });

  it('queues the newest value while a save is in progress', async () => {
    let finishFirst!: (value: ReturnType<typeof filters>) => void;
    setPreferenceMock
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockImplementation(async (_key, value) => value);
    const { result } = renderHook(() => useUserPreference('youth-profile-filters'), { wrapper: createWrapper() });
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
    const { result } = renderHook(() => useUserPreference('youth-profile-filters'), { wrapper: createWrapper() });
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

  it('flushes a pending preference when the page unmounts', async () => {
    setPreferenceMock.mockImplementation(async (_key, value) => value);
    const { result, unmount } = renderHook(() => useUserPreference('youth-profile-filters'), { wrapper: createWrapper() });
    await act(async () => Promise.resolve());

    act(() => result.current.save(filters(['inactive'])));
    unmount();
    await act(async () => Promise.resolve());

    expect(setPreferenceMock).toHaveBeenCalledWith('youth-profile-filters', filters(['inactive']));
  });
});
