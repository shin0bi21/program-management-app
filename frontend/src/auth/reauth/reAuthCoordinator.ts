export type ReAuthStatus = 'idle' | 'prompting';

export interface ReAuthSnapshot {
  status: ReAuthStatus;
}

export interface ReAuthCoordinator {
  getSnapshot(): ReAuthSnapshot;
  subscribe(listener: () => void): () => void;
  requestReAuth(signal?: AbortSignal): Promise<void>;
  resolveReAuth(): void;
  rejectReAuth(error?: Error): void;
}

const IDLE_SNAPSHOT: ReAuthSnapshot = { status: 'idle' };
const PROMPTING_SNAPSHOT: ReAuthSnapshot = { status: 'prompting' };

export function createReAuthCoordinator(): ReAuthCoordinator {
  let snapshot = IDLE_SNAPSHOT;
  let pendingPromise: Promise<void> | null = null;
  const waiters = new Set<{ resolve: () => void; reject: (error: unknown) => void }>();
  const listeners = new Set<() => void>();

  const publish = (nextSnapshot: ReAuthSnapshot) => {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    requestReAuth(signal) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      if (!signal && pendingPromise) return pendingPromise;

      const promise = new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          signal?.removeEventListener('abort', abort);
          waiters.delete(waiter);
        };
        const waiter = {
          resolve: () => { cleanup(); resolve(); },
          reject: (error: unknown) => { cleanup(); reject(error); },
        };
        const abort = () => waiter.reject(signal?.reason);

        waiters.add(waiter);
        signal?.addEventListener('abort', abort, { once: true });
      });
      if (!signal) pendingPromise = promise;
      if (snapshot.status !== 'prompting') publish(PROMPTING_SNAPSHOT);
      return promise;
    },

    resolveReAuth() {
      if (snapshot.status !== 'prompting') return;

      pendingPromise = null;
      waiters.forEach(waiter => waiter.resolve());
      publish(IDLE_SNAPSHOT);
    },

    rejectReAuth(error = new Error('Re-authentication was cancelled.')) {
      if (snapshot.status !== 'prompting') return;

      pendingPromise = null;
      waiters.forEach(waiter => waiter.reject(error));
      publish(IDLE_SNAPSHOT);
    },
  };
}

export const reAuthCoordinator = createReAuthCoordinator();
