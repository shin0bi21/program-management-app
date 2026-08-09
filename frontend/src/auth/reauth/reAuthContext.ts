import { createContext, useContext } from 'react';
import type { ReAuthStatus } from './reAuthCoordinator';

export interface ReAuthContextValue {
  status: ReAuthStatus;
  resolveReAuth: () => void;
  rejectReAuth: (error?: Error) => void;
}

export const ReAuthContext = createContext<ReAuthContextValue | undefined>(undefined);

export function useReAuth(): ReAuthContextValue {
  const context = useContext(ReAuthContext);
  if (!context) {
    throw new Error('useReAuth must be used within ReAuthProvider');
  }
  return context;
}
