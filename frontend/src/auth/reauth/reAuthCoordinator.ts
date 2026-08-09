export type ReAuthStatus = 'idle' | 'prompting';

export interface ReAuthSnapshot {
  status: ReAuthStatus;
}

export interface ReAuthCoordinator {
  getSnapshot(): ReAuthSnapshot;
  subscribe(listener: () => void): () => void;
  requestReAuth(): Promise<void>;
  resolveReAuth(): void;
  rejectReAuth(error?: Error): void;
}

const IDLE_SNAPSHOT: ReAuthSnapshot = { status: 'idle' };
const PROMPTING_SNAPSHOT: ReAuthSnapshot = { status: 'prompting' };

export function createReAuthCoordinator(): ReAuthCoordinator {
  let snapshot = IDLE_SNAPSHOT;
  let pendingPromise: Promise<void> | null = null;
  let resolvePending: (() => void) | null = null;
  let rejectPending: ((error: Error) => void) | null = null;
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

    requestReAuth() {
      if (pendingPromise) return pendingPromise;

      pendingPromise = new Promise<void>((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
      publish(PROMPTING_SNAPSHOT);
      return pendingPromise;
    },

    resolveReAuth() {
      if (!pendingPromise) return;

      const resolve = resolvePending;
      pendingPromise = null;
      resolvePending = null;
      rejectPending = null;
      publish(IDLE_SNAPSHOT);
      resolve?.();
    },

    rejectReAuth(error = new Error('Re-authentication was cancelled.')) {
      if (!pendingPromise) return;

      const reject = rejectPending;
      pendingPromise = null;
      resolvePending = null;
      rejectPending = null;
      publish(IDLE_SNAPSHOT);
      reject?.(error);
    },
  };
}

export const reAuthCoordinator = createReAuthCoordinator();
