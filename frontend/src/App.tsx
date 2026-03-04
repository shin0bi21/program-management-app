import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './common/context/AuthContext'
import ProtectedRoute from './common/components/ProtectedRoute/ProtectedRoute'
import ReLoginModal from './common/components/ReLoginModal/ReLoginModal'
import Homepage from './pages/Homepage/Homepage'
import Youth from './pages/Youth/Youth'
import Staff from './pages/Staff/Staff'
import Account from './pages/Settings/Account/Account'
import Login from './pages/Auth/Login/Login'
import VerifyPassword from './pages/Auth/VerifyPassword/VerifyPassword'
import ForgotPassword from './pages/Auth/ForgotPassword/ForgotPassword'
import ResetPassword from './pages/Auth/ResetPassword/ResetPassword'

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
          <Route path="/" element={<Homepage />} />
          <Route path="/youth" element={
            <ProtectedRoute>
              <Youth />
            </ProtectedRoute>
          } />
          <Route path="/settings/account" element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } />
          <Route path="/settings/staff" element={
            <ProtectedRoute requiredPermission="admin">
              <Staff />
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
