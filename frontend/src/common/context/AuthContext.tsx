import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTokenExpired, decodeToken } from '../utils/jwt';
import { clearAuthData, getToken } from '../utils/storage';
import { api } from '../api/config';

type Permission = 'admin' | 'staff' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  permission: Permission;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [permission, setPermission] = useState<Permission>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const applyToken = (token: string | null) => {
    if (!token || isTokenExpired(token)) {
      clearAuthData();
      setIsAuthenticated(false);
      setPermission(null);
      return;
    }
    try {
      const payload = decodeToken(token);
      setIsAuthenticated(true);
      setPermission((payload?.permission as Permission) ?? null);
    } catch {
      clearAuthData();
      setIsAuthenticated(false);
      setPermission(null);
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
        setPermission(null);
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
    try {
      await fetch(api('/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    } finally {
      clearAuthData();
      setIsAuthenticated(false);
      setPermission(null);
      navigate('/login');
    }
  };

  const value = useMemo(
    () => ({ isAuthenticated, permission, loading, login, logout }),
    [isAuthenticated, permission, loading]
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
