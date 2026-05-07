import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Permission } from '../../context/AuthContext';

const LAST_AUTH_PATH_KEY = 'lastAuthPath';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredPermission?: Permission;
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, permissions, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return <Navigate to="/youth" replace />;
  }

  // Persist the current path so login can redirect back here
  localStorage.setItem(LAST_AUTH_PATH_KEY, location.pathname);

  return children;
}
