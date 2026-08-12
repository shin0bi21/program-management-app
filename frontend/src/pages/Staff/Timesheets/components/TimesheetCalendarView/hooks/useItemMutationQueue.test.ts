import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useItemMutationQueue } from './useItemMutationQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useItemMutationQueue', () => {
  it('serializes same-item updates and identifies only the latest response', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const firstOperation = vi.fn(() => first.promise);
    const secondOperation = vi.fn(() => second.promise);
    const { result } = renderHook(() => useItemMutationQueue());

    const firstMutation = result.current.enqueue('entry-1', firstOperation);
    const secondMutation = result.current.enqueue('entry-1', secondOperation);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(firstOperation).toHaveBeenCalledOnce();
    expect(secondOperation).not.toHaveBeenCalled();
    expect(firstMutation.hadPending).toBe(false);
    expect(secondMutation.hadPending).toBe(true);
    expect(result.current.isLatest('entry-1', firstMutation.revision)).toBe(false);
    expect(result.current.isLatest('entry-1', secondMutation.revision)).toBe(true);

    await act(async () => { first.resolve('first'); await firstMutation.result; });
    expect(secondOperation).toHaveBeenCalledOnce();
    await act(async () => { second.resolve('second'); await secondMutation.result; });
    expect(await secondMutation.result).toBe('second');
  });

  it('continues with the newest update after an earlier request fails', async () => {
    const first = deferred<string>();
    const secondOperation = vi.fn().mockResolvedValue('latest');
    const { result } = renderHook(() => useItemMutationQueue());

    const firstMutation = result.current.enqueue('entry-1', () => first.promise);
    const secondMutation = result.current.enqueue('entry-1', secondOperation);
    first.reject(new Error('offline'));

    await expect(firstMutation.result).rejects.toThrow('offline');
    await expect(secondMutation.result).resolves.toBe('latest');
    expect(secondOperation).toHaveBeenCalledOnce();
  });
});
