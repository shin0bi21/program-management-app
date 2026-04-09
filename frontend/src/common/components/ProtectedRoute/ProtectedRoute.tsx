import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LAST_AUTH_PATH_KEY = 'lastAuthPath';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredPermission?: 'admin' | 'staff';
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, permission, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && permission !== requiredPermission) {
    return <Navigate to="/youth" replace />;
  }

  // Persist the current path so login can redirect back here
  localStorage.setItem(LAST_AUTH_PATH_KEY, location.pathname);

  return children;
}
