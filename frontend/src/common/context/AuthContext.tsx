import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTokenExpired } from '../utils/jwt';
import { clearAuthData, getToken } from '../utils/storage';
import { api } from '../api/config';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const checkAuth = () => {
    const token = getToken();
    
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    try {
      // Decode JWT to check expiry (without verification - backend will verify)
      if (isTokenExpired(token)) {
        clearAuthData();
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
    } catch {
      clearAuthData();
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    // Check if token exists and is valid
    checkAuth();
    setLoading(false);
  }, []);

  const login = () => {
    checkAuth();
  };

  const logout = async () => {
    // Call backend to clear cookie
    await fetch(api('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    
    clearAuthData();
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
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
