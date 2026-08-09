import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type Permission } from '../../../auth/authContext';
import { getUser, rememberAuthPath } from '../../../auth/storage';
import RouteLoading from '../RouteLoading/RouteLoading';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredPermission?: Permission;
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, permissions, loading } = useAuth();
  const location = useLocation();
  const hasRequiredPermission = !requiredPermission || permissions.includes(requiredPermission);

  useEffect(() => {
    if (isAuthenticated && hasRequiredPermission) {
      const userId = getUser()?.id;
      if (userId) rememberAuthPath(userId, `${location.pathname}${location.search}`);
    }
  }, [hasRequiredPermission, isAuthenticated, location.pathname, location.search]);

  if (loading) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRequiredPermission) {
    return <Navigate to="/" replace />;
  }

  return children;
}
