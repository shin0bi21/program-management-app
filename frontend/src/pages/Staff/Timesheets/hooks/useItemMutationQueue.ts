import { useCallback, useRef } from 'react';

export function useItemMutationQueue() {
  const queuesRef = useRef(new Map<string, Promise<unknown>>());
  const revisionsRef = useRef(new Map<string, number>());

  const enqueue = useCallback(<T,>(itemId: string, operation: () => Promise<T>) => {
    const revision = (revisionsRef.current.get(itemId) ?? 0) + 1;
    revisionsRef.current.set(itemId, revision);
    const pending = queuesRef.current.get(itemId);
    const previous = pending ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    queuesRef.current.set(itemId, result);
    void result.finally(() => {
      if (queuesRef.current.get(itemId) === result) queuesRef.current.delete(itemId);
    }).catch(() => undefined);
    return { revision, result, hadPending: Boolean(pending) };
  }, []);

  const isLatest = useCallback((itemId: string, revision: number) => (
    revisionsRef.current.get(itemId) === revision
  ), []);

  return { enqueue, isLatest };
}
