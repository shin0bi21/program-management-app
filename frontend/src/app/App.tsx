import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { ReAuthProvider } from '../auth/reauth/ReAuthProvider';
import ProtectedRoute from '../common/components/ProtectedRoute/ProtectedRoute';
import RouteLoading from '../common/components/RouteLoading/RouteLoading';
import PublicHomepage from '../pages/Homepage/PublicHomepage/PublicHomepage';
import { HOMEPAGE_ROUTE_PATHS } from '../pages/Homepage/PublicHomepage/utils/homepageSections';
import AppNavigation from './components/AppNavigation/AppNavigation';

const ManageHomepage = lazy(() => import('../pages/Homepage/ManageHomepage/ManageHomepage'));
const Youth = lazy(() => import('../pages/Youth/Youth'));
const Users = lazy(() => import('../pages/Settings/Users/Users'));
const Account = lazy(() => import('../pages/Settings/Account/Account'));
const Programs = lazy(() => import('../pages/Programming/Programs/Programs'));
const Leads = lazy(() => import('../pages/Leads/Leads'));
const Sessions = lazy(() => import('../pages/Programming/Sessions/Sessions'));
const Hours = lazy(() => import('../pages/Staff/Hours/Hours'));
const Tasks = lazy(() => import('../pages/Staff/Tasks/Tasks'));
const Login = lazy(() => import('../pages/Auth/Login/Login'));
const VerifyPassword = lazy(() => import('../pages/Auth/VerifyPassword/VerifyPassword'));
const ForgotPassword = lazy(() => import('../pages/Auth/ForgotPassword/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/Auth/ResetPassword/ResetPassword'));

function ProgrammingRedirect({ to }: { to: string }) {
  const location = useLocation();

  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

function AuthenticatedLayout() {
  return (
    <>
      <AppNavigation />
      <Outlet />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ReAuthProvider>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {HOMEPAGE_ROUTE_PATHS.map((path) => (
                <Route key={path} path={path} element={<PublicHomepage />} />
              ))}
              <Route element={<AuthenticatedLayout />}>
                <Route
                  path="/homepage/manage"
                  element={
                    <ProtectedRoute requiredPermission="read:homepage">
                      <ManageHomepage />
                    </ProtectedRoute>
                  }
                />
              <Route path="/youth" element={<Navigate to="/youth/profiles" replace />} />
              <Route
                path="/youth/profiles"
                element={
                  <ProtectedRoute requiredPermission="read:youth_profiles">
                    <Youth />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/account"
                element={
                  <ProtectedRoute>
                    <Account />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/programming/programs"
                element={
                  <ProtectedRoute requiredPermission="read:programs">
                    <Programs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/programming/sessions"
                element={
                  <ProtectedRoute requiredPermission="read:sessions">
                    <Sessions />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings/programming" element={<ProgrammingRedirect to="/programming/programs" />} />
              <Route path="/programming/cohorts" element={<ProgrammingRedirect to="/programming/programs" />} />
              <Route path="/programming/calendar" element={<ProgrammingRedirect to="/programming/sessions" />} />
              <Route
                path="/staff/tasks"
                element={
                  <ProtectedRoute requiredPermission="read:tasks">
                    <Tasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/staff/hours"
                element={
                  <ProtectedRoute requiredPermission="read:hours">
                    <Hours />
                  </ProtectedRoute>
                }
              />
              <Route path="/outreach" element={<Navigate to="/leads/external" replace />} />
              <Route path="/outreach/expressions-of-interest" element={<Navigate to="/leads/external" replace />} />
              <Route path="/outreach/leads" element={<Navigate to="/leads/external" replace />} />
              <Route path="/outreach/leads/external" element={<Navigate to="/leads/external" replace />} />
              <Route path="/outreach/leads/internal" element={<Navigate to="/leads/internal" replace />} />
              <Route path="/outreach/external" element={<Navigate to="/leads/external" replace />} />
              <Route path="/outreach/internal" element={<Navigate to="/leads/internal" replace />} />
              <Route path="/leads" element={<Navigate to="/leads/external" replace />} />
              <Route
                path="/leads/external"
                element={
                  <ProtectedRoute requiredPermission="read:outreach">
                    <Leads key="external" origin="external" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/internal"
                element={
                  <ProtectedRoute requiredPermission="read:outreach">
                    <Leads key="internal" origin="internal" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/users"
                element={
                  <ProtectedRoute requiredPermission="read:accounts">
                    <Users />
                  </ProtectedRoute>
                }
              />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/verify-password" element={<VerifyPassword />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
          </Suspense>
        </ReAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
