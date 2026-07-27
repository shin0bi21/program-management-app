import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './common/context/AuthContext'
import ProtectedRoute from './common/components/ProtectedRoute/ProtectedRoute'
import ReLoginModal from './common/components/ReLoginModal/ReLoginModal'
import Homepage from './pages/Homepage/Homepage'
import ManageHomepage from './pages/Homepage/ManageHomepage'
import Youth from './pages/Youth/Youth'
import YouthLayout from './pages/Youth/YouthLayout'
import Users from './pages/Settings/Users/Users'
import Account from './pages/Settings/Account/Account'
import Outreach from './pages/Outreach/Outreach'
import ExpressionsOfInterest from './pages/Outreach/ExpressionsOfInterest/ExpressionsOfInterest'
import Leads from './pages/Outreach/Leads/Leads'
import ProgrammingLayout from './pages/Programming/ProgrammingLayout'
import Programming from './pages/Programming/Programming'
import Sessions from './pages/Programming/Sessions'
import Login from './pages/Auth/Login/Login'
import VerifyPassword from './pages/Auth/VerifyPassword/VerifyPassword'
import ForgotPassword from './pages/Auth/ForgotPassword/ForgotPassword'
import ResetPassword from './pages/Auth/ResetPassword/ResetPassword'
import { HOMEPAGE_ROUTE_PATHS } from './common/utils/homepageSections'

function App() {
  const [reLoginOpen, setReLoginOpen] = useState(false);

  useEffect(() => {
    const handler = () => setReLoginOpen(true);
    window.addEventListener('auth:sessionExpired', handler);
    return () => window.removeEventListener('auth:sessionExpired', handler);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ReLoginModal isOpen={reLoginOpen} onClose={() => setReLoginOpen(false)} />
        <Routes>
          {HOMEPAGE_ROUTE_PATHS.map((path) => (
            <Route key={path} path={path} element={<Homepage />} />
          ))}
          <Route path="/homepage/manage" element={
            <ProtectedRoute requiredPermission="read:homepage">
              <ManageHomepage />
            </ProtectedRoute>
          } />
          <Route path="/youth" element={
            <ProtectedRoute requiredPermission="read:youth_profiles">
              <YouthLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="profiles" replace />} />
            <Route path="profiles" element={<Youth />} />
          </Route>
          <Route path="/settings/account" element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } />
          <Route path="/programming" element={
            <ProtectedRoute requiredPermission="read:cohorts">
              <ProgrammingLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Programming />} />
            <Route path="sessions" element={
              <ProtectedRoute requiredPermission="read:attendance">
                <Sessions />
              </ProtectedRoute>
            } />
            <Route path="calendar" element={
              <ProtectedRoute requiredPermission="read:attendance">
                <Navigate to="/programming/sessions?view=calendar" replace />
              </ProtectedRoute>
            } />
          </Route>
          <Route path="/outreach" element={
            <ProtectedRoute requiredPermission="read:outreach">
              <Outreach />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="expressions-of-interest" replace />} />
            <Route path="expressions-of-interest" element={<ExpressionsOfInterest />} />
            <Route path="leads" element={<Leads />} />
          </Route>
          <Route path="/settings/users" element={
            <ProtectedRoute requiredPermission="read:accounts">
              <Users />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-password" element={<VerifyPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
