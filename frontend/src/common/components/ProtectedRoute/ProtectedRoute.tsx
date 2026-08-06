import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Permission } from '../../context/AuthContext';
import { STORAGE_KEYS } from '../../utils/storage';
import RouteLoading from '../RouteLoading/RouteLoading';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredPermission?: Permission;
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, permissions, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(STORAGE_KEYS.LAST_AUTH_PATH, location.pathname);
    }
  }, [isAuthenticated, location.pathname]);

  if (loading) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
