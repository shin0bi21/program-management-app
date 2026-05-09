import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTokenExpired, decodeToken } from '../utils/jwt';
import { clearAuthData, getToken } from '../utils/storage';
import { logout as logoutRequest } from '../../pages/Auth/common/api/auth.api';

export type UserRole = string;
export type Permission =
  | 'read:staff'
  | 'write:staff'
  | 'read:youth_profiles'
  | 'write:youth_profiles'
  | 'read:schools'
  | 'read:settings'
  | 'write:settings';

interface AuthContextType {
  isAuthenticated: boolean;
  role: UserRole | null;
  permissions: Permission[];
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const applyToken = (token: string | null) => {
    if (!token || isTokenExpired(token)) {
      clearAuthData();
      setIsAuthenticated(false);
      setRole(null);
      setPermissions([]);
      return;
    }
    try {
      const payload = decodeToken(token);
      setIsAuthenticated(true);
      setRole((payload?.role as UserRole) ?? null);
      setPermissions((payload?.permissions as Permission[]) ?? []);
    } catch {
      clearAuthData();
      setIsAuthenticated(false);
      setRole(null);
      setPermissions([]);
    }
  };

  const checkAuth = () => {
    applyToken(getToken());
  };

  useEffect(() => {
    checkAuth();
    setLoading(false);

    // Sync logout across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token' && !e.newValue) {
        setIsAuthenticated(false);
        setRole(null);
        setPermissions([]);
        navigate('/login');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = () => {
    checkAuth();
  };

  const logout = async () => {
    await logoutRequest().catch(() => {});
    clearAuthData();
    setIsAuthenticated(false);
    setRole(null);
    setPermissions([]);
    navigate('/login');
  };

  const value = useMemo(
    () => ({ isAuthenticated, role, permissions, loading, login, logout }),
    [isAuthenticated, role, permissions, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
