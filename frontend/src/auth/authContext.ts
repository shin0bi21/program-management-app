import { createContext, useContext } from 'react';

export type UserRole = string;
export type Permission =
  | 'read:accounts'
  | 'write:accounts'
  | 'read:youth_profiles'
  | 'write:youth_profiles'
  | 'read:schools'
  | 'read:programs'
  | 'write:programs'
  | 'read:cohorts'
  | 'write:cohorts'
  | 'read:sessions'
  | 'write:sessions'
  | 'read:attendance'
  | 'write:attendance'
  | 'write:schools'
  | 'read:outreach'
  | 'write:outreach'
  | 'read:homepage'
  | 'write:homepage'
  | 'read:settings'
  | 'write:settings'
  | 'read:hours'
  | 'write:hours'
  | 'read:tasks'
  | 'write:tasks';

export interface AuthContextValue {
  isAuthenticated: boolean;
  role: UserRole | null;
  permissions: Permission[];
  loading: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
