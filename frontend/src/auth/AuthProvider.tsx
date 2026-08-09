import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import queryClient from '../query/queryClient';
import { logout as logoutRequest } from './auth.api';
import { AuthContext, type Permission, type UserRole } from './authContext';
import { decodeToken, isTokenExpired } from './jwt';
import { clearAuthData, getToken, STORAGE_KEYS } from './storage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const applyToken = useCallback((token: string | null) => {
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
  }, []);

  const checkAuth = useCallback(() => {
    applyToken(getToken());
  }, [applyToken]);

  useEffect(() => {
    checkAuth();
    setLoading(false);

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.TOKEN && !event.newValue) {
        queryClient.clear();
        setIsAuthenticated(false);
        setRole(null);
        setPermissions([]);
        navigate('/login');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkAuth, navigate]);

  const login = checkAuth;

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => {});
    queryClient.clear();
    clearAuthData();
    setIsAuthenticated(false);
    setRole(null);
    setPermissions([]);
    navigate('/login');
  }, [navigate]);

  const value = useMemo(
    () => ({ isAuthenticated, role, permissions, loading, login, logout }),
    [isAuthenticated, role, permissions, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
