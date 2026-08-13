import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { ReAuthProvider } from '../auth/reauth/ReAuthProvider';
import ProtectedRoute from '../common/components/ProtectedRoute/ProtectedRoute';
import RouteLoading from '../common/components/RouteLoading/RouteLoading';
import Homepage from '../pages/Homepage/Homepage';
import { HOMEPAGE_ROUTE_PATHS } from '../pages/Homepage/homepageSections';
import AppNavigation from './components/AppNavigation/AppNavigation';

const ManageHomepage = lazy(() => import('../pages/Homepage/ManageHomepage'));
const Youth = lazy(() => import('../pages/Youth/Youth'));
const Users = lazy(() => import('../pages/Settings/Users/Users'));
const Account = lazy(() => import('../pages/Settings/Account/Account'));
const ProgrammingSettings = lazy(() => import('../pages/Settings/Programming/Programming'));
const ExpressionsOfInterest = lazy(() => import('../pages/Outreach/ExpressionsOfInterest/ExpressionsOfInterest'));
const Leads = lazy(() => import('../pages/Outreach/Leads/Leads'));
const Cohorts = lazy(() => import('../pages/Programming/Cohorts/Cohorts'));
const Sessions = lazy(() => import('../pages/Programming/Sessions/Sessions'));
const Timesheets = lazy(() => import('../pages/Staff/Timesheets/Timesheets'));
const Tasks = lazy(() => import('../pages/Staff/Tasks/Tasks'));
const Login = lazy(() => import('../pages/Auth/Login/Login'));
const VerifyPassword = lazy(() => import('../pages/Auth/VerifyPassword/VerifyPassword'));
const ForgotPassword = lazy(() => import('../pages/Auth/ForgotPassword/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/Auth/ResetPassword/ResetPassword'));

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
                <Route key={path} path={path} element={<Homepage />} />
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
                path="/settings/programming"
                element={
                  <ProtectedRoute requiredPermission="write:programs">
                    <ProgrammingSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/programming/cohorts"
                element={
                  <ProtectedRoute requiredPermission="read:cohorts">
                    <Cohorts />
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
                  <ProtectedRoute requiredPermission="read:timesheets">
                    <Timesheets />
                  </ProtectedRoute>
                }
              />
              <Route path="/outreach" element={<Navigate to="/outreach/expressions-of-interest" replace />} />
              <Route
                path="/outreach/expressions-of-interest"
                element={
                  <ProtectedRoute requiredPermission="read:outreach">
                    <ExpressionsOfInterest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/outreach/leads"
                element={
                  <ProtectedRoute requiredPermission="read:outreach">
                    <Leads />
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
