import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './common/context/AuthContext'
import ProtectedRoute from './common/components/ProtectedRoute/ProtectedRoute'
import Homepage from './pages/Homepage/Homepage'
import Youth from './pages/Youth/Youth'
import Staff from './pages/Staff/Staff'
import Login from './pages/Auth/Login/Login'
import VerifyPassword from './pages/Auth/VerifyPassword/VerifyPassword'
import ForgotPassword from './pages/Auth/ForgotPassword/ForgotPassword'
import ResetPassword from './pages/Auth/ResetPassword/ResetPassword'
import { startTokenRefreshTimer } from './pages/Auth/api/tokenRefresh'

function App() {
  useEffect(() => {
    // Start automatic token refresh
    startTokenRefreshTimer();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/youth" element={
            <ProtectedRoute>
              <Youth />
            </ProtectedRoute>
          } />
          <Route path="/staff" element={
            <ProtectedRoute>
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
