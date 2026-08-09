import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import ReLoginModal from '../../common/components/ReLoginModal/ReLoginModal';
import { ReAuthContext, type ReAuthContextValue } from './reAuthContext';
import { reAuthCoordinator } from './reAuthCoordinator';

export function ReAuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    reAuthCoordinator.subscribe,
    reAuthCoordinator.getSnapshot,
    reAuthCoordinator.getSnapshot,
  );

  const value = useMemo<ReAuthContextValue>(() => ({
    status: snapshot.status,
    resolveReAuth: reAuthCoordinator.resolveReAuth,
    rejectReAuth: reAuthCoordinator.rejectReAuth,
  }), [snapshot.status]);

  return (
    <ReAuthContext.Provider value={value}>
      {children}
      {snapshot.status === 'prompting' && (
        <ReLoginModal
          isOpen
          onReAuthenticated={reAuthCoordinator.resolveReAuth}
        />
      )}
    </ReAuthContext.Provider>
  );
}
